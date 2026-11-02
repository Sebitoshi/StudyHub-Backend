import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Subscription } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeChatDepth } from '../ai/context/chat-depth';
import {
  BillingPlanDefinition,
  getFreePlan,
  getPlan,
  PREMIUM_PLAN_CODE,
  UNLIMITED_CREDITS,
} from './plans';

/** Profundidades de chat que solo están disponibles con Premium. */
const PREMIUM_DEPTHS = new Set(['max', 'maxpro']);

/** Zona horaria usada para reiniciar los créditos diarios. */
const USAGE_TIMEZONE = process.env.BILLING_TIMEZONE || 'America/Bogota';

export type PremiumFeature = 'image' | 'document' | 'depth';

export interface ChatAccessOptions {
  depth?: string;
  /** Función premium independiente de la profundidad (imagen/documento). */
  premiumOnly?: PremiumFeature | false;
}

export interface AccountSnapshot {
  planCode: string;
  planName: string;
  premium: boolean;
  dailyCredits: number | null;
  used: number;
  remaining: number | null;
  premiumUsed: number;
  subscription: {
    status: string;
    provider: string;
    currentPeriodEnd: string | null;
    cancelledAt: string | null;
    initPoint: string | null;
  } | null;
}

/** Día calendario (medianoche UTC) que representa la fecha local del usuario. */
export function usageDayKey(now: Date = new Date()): Date {
  let formatted: string;
  try {
    formatted = new Intl.DateTimeFormat('en-CA', {
      timeZone: USAGE_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  } catch {
    formatted = now.toISOString().slice(0, 10);
  }
  return new Date(`${formatted}T00:00:00.000Z`);
}

@Injectable()
export class EntitlementsService {
  private readonly logger = new Logger(EntitlementsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Suscripción vigente: autorizada (o cancelada) mientras dure el periodo pagado. */
  isSubscriptionActive(subscription: Subscription | null): boolean {
    if (!subscription) return false;
    if (subscription.status !== 'AUTHORIZED' && subscription.status !== 'CANCELLED') {
      return false;
    }
    if (!subscription.currentPeriodEnd) return false;
    return subscription.currentPeriodEnd.getTime() > Date.now();
  }

  private resolvePlan(subscription: Subscription | null): BillingPlanDefinition {
    if (!this.isSubscriptionActive(subscription)) return getFreePlan();
    return getPlan(subscription?.planCode) ?? getPlan(PREMIUM_PLAN_CODE) ?? getFreePlan();
  }

  async getAccount(userId: number): Promise<AccountSnapshot> {
    const day = usageDayKey();
    let subscription: Subscription | null = null;
    let usage: { messages: number; premiumUses: number } | null = null;

    try {
      [subscription, usage] = await Promise.all([
        this.prisma.subscription.findUnique({ where: { userId } }),
        this.prisma.aiDailyUsage.findUnique({
          where: { userId_day: { userId, day } },
        }),
      ]);
    } catch (err: any) {
      // Despliegue sin la migración aplicada: las tablas no existen todavía.
      // El chat debe seguir funcionando con el plan gratis en lugar de fallar.
      this.logger.warn(
        `No se pudo leer el estado de facturación (${err?.code || err?.message}); se usa el plan gratis.`,
      );
      return this.freeAccountSnapshot();
    }

    const plan = this.resolvePlan(subscription);
    const used = usage?.messages ?? 0;
    const unlimited = plan.dailyCredits === UNLIMITED_CREDITS;

    return {
      planCode: plan.code,
      planName: plan.name,
      premium: plan.premium,
      dailyCredits: unlimited ? null : plan.dailyCredits,
      used,
      remaining: unlimited ? null : Math.max(0, plan.dailyCredits - used),
      premiumUsed: usage?.premiumUses ?? 0,
      subscription: subscription
        ? {
            status: subscription.status,
            provider: subscription.provider,
            currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
            cancelledAt: subscription.cancelledAt?.toISOString() ?? null,
            initPoint: subscription.initPoint,
          }
        : null,
    };
  }

  private freeAccountSnapshot(): AccountSnapshot {
    const plan = getFreePlan();
    return {
      planCode: plan.code,
      planName: plan.name,
      premium: false,
      dailyCredits: plan.dailyCredits,
      used: 0,
      remaining: plan.dailyCredits,
      premiumUsed: 0,
      subscription: null,
    };
  }

  private paymentRequired(
    code: 'PREMIUM_REQUIRED' | 'AI_DAILY_LIMIT_REACHED',
    message: string,
    extra: Record<string, unknown> = {},
  ): HttpException {
    return new HttpException(
      {
        statusCode: HttpStatus.PAYMENT_REQUIRED,
        error: 'Payment Required',
        code,
        message,
        ...extra,
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }

  /**
   * Verifica que el usuario pueda usar el chat antes de llamar al modelo.
   * Lanza 402 si la función es premium o si agotó sus créditos del día.
   */
  async assertChatAccess(
    userId: number,
    options: ChatAccessOptions = {},
  ): Promise<AccountSnapshot> {
    const account = await this.getAccount(userId);
    const wantsPremium =
      Boolean(options.premiumOnly) ||
      PREMIUM_DEPTHS.has(normalizeChatDepth(options.depth));

    if (wantsPremium && !account.premium) {
      throw this.paymentRequired(
        'PREMIUM_REQUIRED',
        'Esta función requiere el plan Premium.',
        { premiumOnly: true },
      );
    }

    if (account.dailyCredits !== null && account.used >= account.dailyCredits) {
      throw this.paymentRequired(
        'AI_DAILY_LIMIT_REACHED',
        'Agotaste tus créditos diarios del chat IA. Se renuevan mañana.',
        {
          dailyCredits: account.dailyCredits,
          used: account.used,
          resetAt: new Date(usageDayKey().getTime() + 24 * 60 * 60 * 1000).toISOString(),
        },
      );
    }

    return account;
  }

  /** Suma un mensaje al consumo diario (y un uso premium si aplica). */
  async recordChatUsage(userId: number, options: ChatAccessOptions = {}): Promise<void> {
    const day = usageDayKey();
    const premiumUse =
      Boolean(options.premiumOnly) || PREMIUM_DEPTHS.has(normalizeChatDepth(options.depth));

    try {
      await this.prisma.aiDailyUsage.upsert({
        where: { userId_day: { userId, day } },
        create: {
          userId,
          day,
          messages: 1,
          premiumUses: premiumUse ? 1 : 0,
        },
        update: {
          messages: { increment: 1 },
          ...(premiumUse ? { premiumUses: { increment: 1 } } : {}),
        },
      });
    } catch (err: any) {
      // El consumo jamás debe romper una respuesta que el modelo ya generó.
      this.logger.warn(
        `No se pudo registrar el consumo diario (${err?.code || err?.message}).`,
      );
    }
  }
}
