import { Injectable } from '@nestjs/common';

@Injectable()
export class RiskRecommendationService {
  getRecommendations(
    level: string,
    reasons: string[],
    subjectName?: string,
  ): string[] {
    const recs: string[] = [];

    if (reasons.some((r) => r.includes('gap'))) {
      recs.push(
        `Revisa los gaps de conocimiento en ${subjectName || 'tus materias'} y practica con quizzes`,
      );
    }

    if (reasons.some((r) => r.includes('tarea'))) {
      recs.push(
        'Prioriza las tareas vencidas organizándolas por fecha de entrega',
      );
    }

    if (reasons.some((r) => r.includes('confianza'))) {
      recs.push(
        'Repasa los fundamentos con flashcards y resúmenes generados por IA',
      );
    }

    if (reasons.some((r) => r.includes('roadmap'))) {
      recs.push(
        'Dedica al menos 30 minutos diarios a tu roadmap de aprendizaje',
      );
    }

    if (reasons.some((r) => r.includes('actividad'))) {
      recs.push(
        'Vuelve a la rutina: 15 minutos de estudio hoy pueden reactivar tu racha',
      );
    }

    if (level === 'HIGH') {
      recs.push(
        'Considera hablar con un tutor o usar el modo de estudio adaptativo',
      );
      recs.push('Genera un plan de recuperación con el asistente IA');
    }

    if (level === 'MEDIUM') {
      recs.push('Establece metas diarias pequeñas para retomar el ritmo');
    }

    if (recs.length === 0) {
      recs.push('Sigue así, mantén tu ritmo de estudio actual');
    }

    return recs;
  }
}
