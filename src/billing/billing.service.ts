import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementsService } from './entitlements.service';
import { MercadoPagoService, ProviderSubscription } from './mercadopago.service';
import { getPlan, getPlans, PREMIUM_PLAN_CODE } from './plans';

interface WebhookInput {
  headers: Record<string, any>;
  query: Record<string, any>;
  body: any;
}

function mapProviderStatus(status: string | undefined): SubscriptionStatus {
  switch (String(status || '').toLowerCase()) {
    case 'authorized':
      return 'AUTHORIZED';
    case 'paused':
      return 'PAUSED';
    case 'cancelled':
      return 'CANCELLED';
    case 'finished':
    case 'expired':
      return 'EXPIRED';
    default:
      return 'PENDING';
  }
}

function userIdFromExternalReference(reference: string | null | undefined): number | null {
  const match = /^user:(\d+)$/.exec(String(reference || ''));
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isInteger(id) && id > 0 ? id : null;
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
    private readonly mercadoPago: MercadoPagoService,
  ) {}

  listPlans() {
    return { currency: 'COP', plans: getPlans() };
  }

  getAccount(userId: number) {
    return this.entitlements.getAccount(userId);
  }

  /**
   * Crea (o reanuda) el checkout de una suscripción mensual. Devuelve el
   * `initPoint` al que el frontend debe redirigir al estudiante.
   */
  async startSubscription(userId: number, planCode?: string) {
    const requestedCode = String(planCode || PREMIUM_PLAN_CODE).trim().toUpperCase();
    const plan = getPlan(requestedCode);
    if (!plan || !plan.premium) {
      throw new BadRequestException('El plan solicitado no existe o no es de pago.');
    }
    if (!this.mercadoPago.isConfigured()) {
      throw new ServiceUnavailableException(
        'Los pagos todavía no están disponibles (falta configurar Mercado Pago).',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const existing = await this.prisma.subscription.findUnique({ where: { userId } });
    if (this.entitlements.isSubscriptionActive(existing)) {
      throw new ConflictException('Ya tienes una suscripción Premium activa.');
    }
    if (
      existing?.providerSubscriptionId &&
      existing.status === 'PENDING' &&
      existing.initPoint
    ) {
      return {
        planCode: existing.planCode,
        subscriptionId: existing.providerSubscriptionId,
        initPoint: existing.initPoint,
        status: existing.status,
        amountCop: existing.amountCop,
      };
    }

    const created = await this.mercadoPago.createMonthlySubscription({
      reason: `Study Hub ${plan.name}`,
      userId,
      payerEmail: user.email,
      amountCop: plan.priceCop,
      backUrl: this.mercadoPago.backUrl(),
      notificationUrl: this.mercadoPago.webhookUrl(),
    });

    if (!this.mercadoPago.webhookUrl()) {
      this.logger.warn(
        'Sin BILLING_WEBHOOK_URL ni APP_PUBLIC_URL: Mercado Pago no podrá notificar los pagos de la suscripción.',
      );
    }

    if (!created.id) {
      throw new ServiceUnavailableException('Mercado Pago no devolvió la suscripción creada.');
    }

    await this.prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        planCode: plan.code,
        provider: 'mercadopago',
        providerSubscriptionId: created.id,
        status: mapProviderStatus(created.status),
        payerEmail: created.payerEmail || user.email,
        initPoint: created.initPoint,
        amountCop: created.amountCop ?? plan.priceCop,
        currentPeriodEnd: created.nextPaymentDate,
      },
      update: {
        planCode: plan.code,
        provider: 'mercadopago',
        providerSubscriptionId: created.id,
        status: mapProviderStatus(created.status),
        payerEmail: created.payerEmail || user.email,
        initPoint: created.initPoint,
        amountCop: created.amountCop ?? plan.priceCop,
        currentPeriodEnd: created.nextPaymentDate,
        cancelledAt: null,
      },
    });

    return {
      planCode: plan.code,
      subscriptionId: created.id,
      initPoint: created.initPoint,
      status: mapProviderStatus(created.status),
      amountCop: created.amountCop ?? plan.priceCop,
    };
  }

  /**
   * Cancela la suscripción recurrente en Mercado Pago. El acceso Premium se
   * mantiene hasta el final del periodo ya pagado (`currentPeriodEnd`).
   */
  async cancelSubscription(userId: number) {
    const subscription = await this.prisma.subscription.findUnique({ where: { userId } });
    if (!subscription || !subscription.providerSubscriptionId) {
      throw new NotFoundException('No tienes una suscripción para cancelar.');
    }
    if (subscription.status === 'CANCELLED') {
      return this.entitlements.getAccount(userId);
    }

    const cancelled = await this.mercadoPago.cancelSubscription(
      subscription.providerSubscriptionId,
    );
    if (!cancelled) {
      throw new ServiceUnavailableException(
        'No se pudo cancelar la suscripción. Inténtalo de nuevo en unos minutos.',
      );
    }

    await this.prisma.subscription.update({
      where: { userId },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });

    return this.entitlements.getAccount(userId);
  }

  /**
   * Procesa las notificaciones de Mercado Pago. Solo se aceptan eventos con
   * firma válida y se confirma el estado consultando la API (nunca se confía
   * en el cuerpo del webhook).
   */
  async handleWebhook(input: WebhookInput) {
    const body = input.body ?? {};
    const dataId = String(input.query?.['data.id'] ?? body?.data?.id ?? '');
    const type = String(body?.type ?? body?.topic ?? '');
    const eventId = String(
      body?.id ?? input.query?.['data.id'] ?? `${type}:${dataId}`,
    );

    if (!dataId) return { received: true };

    const signature = this.mercadoPago.validateWebhookSignature({
      xSignature: input.headers?.['x-signature'],
      xRequestId: input.headers?.['x-request-id'],
      dataId,
    });
    if (!signature.ok) {
      this.logger.warn(
        `Webhook rechazado (${signature.reason}) para ${type}:${dataId}`,
      );
      throw new UnauthorizedException('Firma de webhook inválida');
    }

    if (type !== 'subscription_preapproval' && type !== 'subscription_authorized_payment') {
      return { received: true, ignored: type || 'unknown' };
    }

    const alreadyProcessed = await this.prisma.billingEvent.findUnique({
      where: { eventId },
    });
    if (alreadyProcessed?.processedAt) {
      return { received: true, duplicated: true };
    }

    try {
      if (type === 'subscription_preapproval') {
        const providerSubscription = await this.mercadoPago.getSubscription(dataId);
        if (!providerSubscription) {
          throw new ServiceUnavailableException(
            `Mercado Pago no devolvió la suscripción ${dataId}`,
          );
        }
        await this.syncSubscription(providerSubscription);
      } else {
        const preapprovalId = await this.mercadoPago.getAuthorizedPaymentPreapprovalId(dataId);
        if (!preapprovalId) {
          throw new ServiceUnavailableException(
            `No se pudo resolver el pago autorizado ${dataId}`,
          );
        }
        const providerSubscription = await this.mercadoPago.getSubscription(preapprovalId);
        if (!providerSubscription) {
          throw new ServiceUnavailableException(
            `Mercado Pago no devolvió la suscripción ${preapprovalId}`,
          );
        }
        await this.syncSubscription(providerSubscription);
      }

      await this.prisma.billingEvent.upsert({
        where: { eventId },
        create: {
          eventId,
          provider: 'mercadopago',
          type,
          payload: body,
          processedAt: new Date(),
        },
        update: {
          type,
          payload: body,
          processedAt: new Date(),
          error: null,
        },
      });
      return { received: true };
    } catch (err: any) {
      const message = String(err?.message || err || 'error').slice(0, 500);
      this.logger.error(`Webhook ${eventId} falló: ${message}`);
      await this.prisma.billingEvent.upsert({
        where: { eventId },
        create: { eventId, provider: 'mercadopago', type, payload: body, error: message },
        update: { error: message },
      });
      throw err;
    }
  }

  /** Aplica el estado autoritativo de Mercado Pago sobre la suscripción local. */
  private async syncSubscription(providerSubscription: ProviderSubscription) {
    if (!providerSubscription.id) return;

    const existing = await this.prisma.subscription.findFirst({
      where: {
        OR: [
          { providerSubscriptionId: providerSubscription.id },
          ...(userIdFromExternalReference(providerSubscription.externalReference) != null
            ? [{ userId: userIdFromExternalReference(providerSubscription.externalReference)! }]
            : []),
        ],
      },
    });

    const userId =
      existing?.userId ?? userIdFromExternalReference(providerSubscription.externalReference);
    if (!userId) {
      this.logger.warn(
        `Suscripción ${providerSubscription.id} sin usuario asociado (external_reference=${providerSubscription.externalReference})`,
      );
      return;
    }

    const status = mapProviderStatus(providerSubscription.status);
    const currentPeriodEnd =
      providerSubscription.nextPaymentDate ?? existing?.currentPeriodEnd ?? null;

    await this.prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        planCode: PREMIUM_PLAN_CODE,
        provider: 'mercadopago',
        providerSubscriptionId: providerSubscription.id,
        status,
        payerEmail: providerSubscription.payerEmail,
        amountCop: providerSubscription.amountCop,
        currentPeriodEnd,
        authorizedAt: status === 'AUTHORIZED' ? new Date() : null,
        cancelledAt: status === 'CANCELLED' ? new Date() : null,
      },
      update: {
        providerSubscriptionId: providerSubscription.id,
        status,
        payerEmail: providerSubscription.payerEmail ?? existing?.payerEmail ?? null,
        amountCop: providerSubscription.amountCop ?? existing?.amountCop ?? null,
        currentPeriodEnd,
        ...(status === 'AUTHORIZED' ? { authorizedAt: new Date(), initPoint: null } : {}),
        ...(status === 'CANCELLED' ? { cancelledAt: new Date() } : {}),
      },
    });
  }
}
