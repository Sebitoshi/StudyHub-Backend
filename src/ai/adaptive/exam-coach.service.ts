import { Injectable } from '@nestjs/common';

@Injectable()
export class ExamCoachService {
  private readonly examPhrasePattern = /tengo examen mañana|parcial mañana|final la pr[oó]xima semana|evaluaci[oó]n pronto|examen|parcial|final|quiz|simulacro|preparar|prueba/;

  detectExamPhrase(message: string) {
    return this.examPhrasePattern.test((message || '').toLowerCase());
  }

  generateMockExam(topic: string, count = 5) {
    return Array.from({ length: count }).map((_, i) => ({ q: `Pregunta ${i + 1} sobre ${topic}`, type: 'short_answer' }));
  }

  quickTips(topic: string) {
    return [
      `Revisa definiciones clave de ${topic}.`,
      `Practica 3 ejercicios de dificultad creciente sobre ${topic}.`,
      `Haz resumen de 1 página con fórmulas y ejemplos.`,
      `Simula condiciones de examen: tiempo limitado y sin apuntes.`,
    ];
  }

  buildExamContext(topic: string) {
    return {
      mode: 'EXAM_MODE',
      tips: this.quickTips(topic),
      mockExam: this.generateMockExam(topic, 6),
    };
  }
}
