import { Injectable } from '@nestjs/common';

@Injectable()
export class LearningPathService {
  createQuickPath(goal: string, days: number) {
    const perDay = Math.max(1, Math.ceil(7 / Math.max(1, days)));
    return {
      title: `Ruta rápida: ${goal}`,
      daysRemaining: days,
      tasks: Array.from({ length: days }).map((_, i) => ({ day: i + 1, tasks: [`Estudiar componente ${i + 1}`, `Práctica: problema ${i + 1}`] })),
    };
  }
}
