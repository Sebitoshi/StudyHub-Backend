import { Injectable } from '@nestjs/common';

@Injectable()
export class ExamCoachService {
  generateMockExam(topic: string, count = 5) {
    return Array.from({ length: count }).map((_, i) => ({ q: `Pregunta ${i + 1} sobre ${topic}`, type: 'short_answer' }));
  }

  quickTips(topic: string) {
    return [`Revisa definiciones clave de ${topic}.`, `Practica 3 ejercicios de dificultad creciente sobre ${topic}.`, `Haz resumen de 1 página con fórmulas y ejemplos.`];
  }
}
