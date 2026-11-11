/**
 * Catálogo de planes de Study Hub.
 *
 * Los planes viven en código (no en base de datos) para que el precio y los
 * créditos se puedan ajustar con variables de entorno sin migraciones. Cada
 * suscripción guarda el `planCode` con el que se contrató.
 *
 * Vista de la cuenta gratis:
 *   - Chat IA: 80 mensajes / día (1 crédito por mensaje).
 *   - Créditos para imágenes, PDF y análisis: 25 usos / día (1 crédito por uso).
 * Premium: chat ilimitado e imágenes/PDF/análisis ilimitados.
 */
export const FREE_PLAN_CODE = 'FREE';
export const PREMIUM_PLAN_CODE = 'PREMIUM';
export const BILLING_CURRENCY = 'COP';

/** -1 significa créditos ilimitados. */
export const UNLIMITED_CREDITS = -1;

export interface BillingPlanDefinition {
  code: string;
  name: string;
  description: string;
  priceCop: number;
  currency: typeof BILLING_CURRENCY;
  /** Mensajes de chat permitidos por día. -1 = ilimitados. */
  chatDailyCredits: number;
  /** Usos premium diarios (imagen, PDF, análisis). -1 = ilimitados. */
  premiumDailyUses: number;
  features: string[];
  premium: boolean;
}

function readIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  const rounded = Math.trunc(value);
  return rounded < UNLIMITED_CREDITS ? fallback : rounded;
}

export function getFreePlan(): BillingPlanDefinition {
  return {
    code: FREE_PLAN_CODE,
    name: 'Gratis',
    description:
      '80 mensajes de chat al día más 25 créditos diarios para recursos con IA.',
    priceCop: 0,
    currency: BILLING_CURRENCY,
    chatDailyCredits: readIntEnv('AI_FREE_DAILY_CREDITS', 80),
    premiumDailyUses: readIntEnv('AI_FREE_PREMIUM_USES', 25),
    features: [
      '80 mensajes de chat al día',
      '25 créditos diarios para quizzes, simulacros, imágenes y PDF',
      'Contexto académico y progreso',
      'Apuntes y metas de aprendizaje',
    ],
    premium: false,
  };
}

export function getPremiumPlan(): BillingPlanDefinition {
  return {
    code: PREMIUM_PLAN_CODE,
    name: 'Premium',
    description:
      'Chat sin límite, modos max/maxpro y análisis de imágenes y documentos ilimitados.',
    priceCop: readIntEnv('AI_PREMIUM_PRICE_COP', 5000),
    currency: BILLING_CURRENCY,
    chatDailyCredits: UNLIMITED_CREDITS,
    premiumDailyUses: UNLIMITED_CREDITS,
    features: [
      'Chat IA sin límite diario',
      'Modos max y maxpro (apuntes completos)',
      'Análisis de imágenes y documentos ilimitados',
      'Soporte prioritario',
    ],
    premium: true,
  };
}

export function getPlans(): BillingPlanDefinition[] {
  return [getFreePlan(), getPremiumPlan()];
}

export function getPlan(code: string | null | undefined): BillingPlanDefinition | null {
  const normalized = String(code || '').trim().toUpperCase();
  if (normalized === PREMIUM_PLAN_CODE) return getPremiumPlan();
  if (normalized === FREE_PLAN_CODE) return getFreePlan();
  return null;
}
