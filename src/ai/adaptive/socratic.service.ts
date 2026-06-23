import { Injectable } from '@nestjs/common';

@Injectable()
export class SocraticService {
  /**
   * Decide a socratic mode based on message and student model.
   * Returns one of: 'SOCRATIC_LIGHT'|'SOCRATIC_MEDIUM'|'SOCRATIC_DEEP'|'EXPLICIT'|'COACH'|'GUIDED'
   */
  decideMode(message: string, model?: any) {
    const t = (message || '').toLowerCase();
    // explicit user asks for full solution
    if (/dame la respuesta|la solución|resolver completo|respuesta completa/.test(t)) return 'EXPLICIT';
    // exam triggers coach
    if (/examen|parcial|simulacro|preparar|prueba/.test(t)) return 'COACH';

    // Default model-driven socratic depth
    const mastery = typeof model?.masteryScore === 'number' ? model.masteryScore : 0.5;
    const engagement = typeof model?.engagementScore === 'number' ? model.engagementScore : 0.5;
    const confs = model?.confidencePerSubject ? Object.values(model.confidencePerSubject).map((v: any) => Number(v)) : [];
    const minConf = confs.length ? Math.min(...confs) : mastery;

    // compute difficulty factor from academic level (higher -> slightly higher difficulty)
    let levelFactor = 1;
    const lvl = model?.academicLevel;
    if (typeof lvl === 'number') levelFactor = 1 + Math.max(0, (lvl - 2)) * 0.1;
    else if (typeof lvl === 'string') {
      if (lvl.match(/secundaria|high/i)) levelFactor = 1.0;
      else if (lvl.match(/universidad|college|grado|undergrad/i)) levelFactor = 1.15;
      else levelFactor = 1.05;
    }

    const risk = (1 - mastery) * levelFactor + (1 - minConf) * 0.5;

    // Decide depth with thresholds tuned to be sensitive to regressions and low confidence
    if (risk > 0.75 || minConf < 0.35) return 'SOCRATIC_DEEP';
    if (risk > 0.45 || minConf < 0.6) return 'SOCRATIC_MEDIUM';
    return 'SOCRATIC_LIGHT';
  }

  /**
   * Generate a sequence of Socratic prompts adapting to depth.
   * depth: 'SOCRATIC_LIGHT'|'SOCRATIC_MEDIUM'|'SOCRATIC_DEEP'
   */
  generateSocraticPrompts(question: string, depth: string) {
    if (depth === 'SOCRATIC_LIGHT') return ['Primera pista: ¿Qué conceptos clave aparecen en este problema?'];
    if (depth === 'SOCRATIC_MEDIUM') return [
      'Primera pista: Identifica los conceptos relevantes y explica por qué aplican.',
      'Segunda pista: Escribe un esquema o plan de solución paso a paso breve.'
    ];
    // deep
    return [
      'Paso 1: Divide el problema en sub-problemas y describe cada uno en una frase.',
      'Paso 2: Para cada sub-problema, escribe una estrategia concreta (definición, teorema o ejemplo).',
      'Paso 3: Intenta resolver un caso simple y explica el razonamiento paso a paso.',
      'Paso 4: Une los resultados parciales y concluye la solución general; señala posibles errores comunes.'
    ];
  }
}
