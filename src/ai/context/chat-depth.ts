/**
 * Profundidad del contexto que el Profesor IA recibe en cada mensaje.
 *
 * - auto   (Auto):      por defecto. Detecta el profesor y la materia que el
 *                       estudiante necesita y se adapta automáticamente.
 * - low    (Low Flash): solo la conversación. Sin datos del estudiante.
 * - medium (Medium):     perfil académico básico + progreso en quizzes,
 *                       rutas y simulacros.
 * - max    (Max):        lo anterior + apuntes de las materias del profesor
 *                       que el estudiante eligió.
 * - maxpro (Max Pro):    lo anterior + apuntes de cualquier materia (los dos
 *                       más recientes por materia, priorizando los que se
 *                       relacionan con la pregunta).
 */
export type ChatDepth = 'auto' | 'low' | 'medium' | 'max' | 'maxpro';

export const CHAT_DEPTH_VALUES: ChatDepth[] = ['auto', 'low', 'medium', 'max', 'maxpro'];

export const CHAT_DEPTH_LABELS: Record<ChatDepth, string> = {
  auto: 'Auto',
  low: 'Low Flash',
  medium: 'Medium',
  max: 'Max',
  maxpro: 'Max Pro',
};

export function normalizeChatDepth(value?: string | null): ChatDepth {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');

  if (!normalized) return 'auto';
  if (normalized === 'auto' || normalized === 'automatico') return 'auto';
  if (normalized === 'low' || normalized === 'flash' || normalized === 'lowflash' || normalized === 'rapido') {
    return 'low';
  }
  if (normalized === 'maxpro' || normalized === 'pro' || normalized === 'maxprofesional') {
    return 'maxpro';
  }
  if (normalized === 'max' || normalized === 'high' || normalized === 'maximo') {
    return 'max';
  }
  if (normalized === 'medium' || normalized === 'medio') return 'medium';
  // Por defecto: modo automático.
  return 'auto';
}
