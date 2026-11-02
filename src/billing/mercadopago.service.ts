import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import {
  MercadoPagoConfig,
  PreApproval,
  WebhookSignatureValidator,
} from 'mercadopago';

const MP_API_BASE = 'https://api.mercadopago.com';

export interface ProviderSubscription {
  id: string;
  status: string;
  initPoint?: string | null;
  nextPaymentDate?: Date | null;
  payerEmail?: string | null;
  amountCop?: number | null;
  externalReference?: string | null;
}

/**
 * Envoltorio mínimo del SDK de Mercado Pago para suscripciones (preapproval).
 *
 * Si `MERCADOPAGO_ACCESS_TOKEN` no está configurado, el servicio queda inactivo
 * y los endpoints de pago responden 503 en lugar de fallar en silencio.
 */
@Injectable()
export class MercadoPagoService {
  private readonly logger = new Logger(MercadoPagoService.name);

  private get accessToken(): string {
    return (process.env.MERCADOPAGO_ACCESS_TOKEN || '').trim();
  }

  get webhookSecret(): string {
    return (process.env.MERCADOPAGO_WEBHOOK_SECRET || '').trim();
  }

  isConfigured(): boolean {
    return this.accessToken.length > 0;
  }

  private client(): PreApproval {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'Los pagos no están configurados todavía (falta MERCADOPAGO_ACCESS_TOKEN).',
      );
    }
    return new PreApproval(
      new MercadoPagoConfig({ accessToken: this.accessToken }),
    );
  }

  /** URL de retorno tras autorizar o rechazar el checkout. */
  backUrl(): string {
    const base = (process.env.BILLING_BACK_URL || process.env.APP_PUBLIC_URL || '').trim();
    if (!base) {
      throw new ServiceUnavailableException(
        'Falta configurar BILLING_BACK_URL con la URL de retorno del frontend.',
      );
    }
    return base;
  }

  private toProviderSubscription(raw: any): ProviderSubscription {
    const nextPayment =
      raw?.next_payment_date != null ? new Date(Number(raw.next_payment_date)) : null;
    return {
      id: String(raw?.id || ''),
      status: String(raw?.status || 'pending').toLowerCase(),
      initPoint: raw?.init_point ? String(raw.init_point) : null,
      nextPaymentDate:
        nextPayment && !Number.isNaN(nextPayment.getTime()) ? nextPayment : null,
      payerEmail: raw?.payer_email ? String(raw.payer_email) : null,
      amountCop:
        raw?.auto_recurring?.transaction_amount != null
          ? Math.round(Number(raw.auto_recurring.transaction_amount))
          : null,
      externalReference:
        raw?.external_reference != null ? String(raw.external_reference) : null,
    };
  }

  /**
   * Crea una suscripción mensual sin plan asociado: el precio y el periodo se
   * fijan en el `auto_recurring` y el estudiante autoriza en el `init_point`.
   */
  async createMonthlySubscription(input: {
    reason: string;
    userId: number;
    payerEmail: string;
    amountCop: number;
    backUrl: string;
  }): Promise<ProviderSubscription> {
    try {
      const response = await this.client().create({
        body: {
          reason: input.reason,
          external_reference: `user:${input.userId}`,
          payer_email: input.payerEmail,
          back_url: input.backUrl,
          status: 'pending',
          auto_recurring: {
            frequency: 1,
            frequency_type: 'months',
            transaction_amount: input.amountCop,
            currency_id: 'COP',
          },
        },
      });
      return this.toProviderSubscription(response);
    } catch (err) {
      this.logger.error(
        `No se pudo crear la suscripción en Mercado Pago: ${this.describeError(err)}`,
      );
      throw new ServiceUnavailableException(
        'No se pudo iniciar el pago en este momento. Inténtalo de nuevo en unos minutos.',
      );
    }
  }

  async getSubscription(providerId: string): Promise<ProviderSubscription | null> {
    try {
      const response = await this.client().get({ id: providerId });
      return this.toProviderSubscription(response);
    } catch (err) {
      this.logger.warn(
        `No se pudo consultar la suscripción ${providerId}: ${this.describeError(err)}`,
      );
      return null;
    }
  }

  async cancelSubscription(providerId: string): Promise<boolean> {
    try {
      await this.client().update({ id: providerId, body: { status: 'cancelled' } });
      return true;
    } catch (err) {
      this.logger.error(
        `No se pudo cancelar la suscripción ${providerId}: ${this.describeError(err)}`,
      );
      return false;
    }
  }

  /**
   * Devuelve el `preapproval_id` de un cobro autorizado. Se usa en el webhook
   * `subscription_authorized_payment` para refrescar el periodo pagado.
   */
  async getAuthorizedPaymentPreapprovalId(authorizedPaymentId: string): Promise<string | null> {
    try {
      const response = await fetch(`${MP_API_BASE}/authorized_payments/${authorizedPaymentId}`, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      if (!response.ok) return null;
      const body: any = await response.json();
      return body?.preapproval_id ? String(body.preapproval_id) : null;
    } catch (err) {
      this.logger.warn(
        `No se pudo consultar el cobro ${authorizedPaymentId}: ${this.describeError(err)}`,
      );
      return null;
    }
  }

  /**
   * Valida la firma `x-signature` del webhook. Si no hay secreto configurado se
   * rechaza el evento: nunca se confía en un webhook sin verificar.
   */
  validateWebhookSignature(input: {
    xSignature?: string | string[];
    xRequestId?: string | string[];
    dataId?: string | string[];
  }): { ok: true } | { ok: false; reason: string } {
    const secret = this.webhookSecret;
    if (!secret) return { ok: false, reason: 'MissingWebhookSecret' };
    try {
      WebhookSignatureValidator.validate({
        xSignature: input.xSignature,
        xRequestId: input.xRequestId,
        dataId: input.dataId,
        secret,
        toleranceSeconds: 15 * 60,
      });
      return { ok: true };
    } catch (err: any) {
      return { ok: false, reason: String(err?.reason || err?.message || 'InvalidSignature') };
    }
  }

  private describeError(err: any): string {
    const status = err?.status ?? err?.statusCode ?? 'sin estado';
    const message = String(err?.message || err || 'error desconocido');
    return `(${status}) ${message}`.slice(0, 400);
  }
}
