/**
 * Catálogo de planes de Study Hub.
 *
 * Los planes viven en código (no en base de datos) para que el precio y los
 * créditos se puedan ajustar con variables de entorno sin migraciones. Cada
 * suscripción guarda el `planCode` con el que se contrató.
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
  dailyCredits: number;
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
    description: 'Chat con el tutor IA y contexto académico básico.',
    priceCop: 0,
    currency: BILLING_CURRENCY,
    dailyCredits: readIntEnv('AI_FREE_DAILY_CREDITS', 25),
    features: [
      'Chat con el tutor IA',
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
      'Chat sin límite, modos max/maxpro y análisis de imágenes y documentos.',
    priceCop: readIntEnv('AI_PREMIUM_PRICE_COP', 29900),
    currency: BILLING_CURRENCY,
    dailyCredits: readIntEnv('AI_PREMIUM_DAILY_CREDITS', UNLIMITED_CREDITS),
    features: [
      'Chat IA sin límite diario',
      'Modos max y maxpro (apuntes completos)',
      'Análisis de imágenes y documentos',
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
