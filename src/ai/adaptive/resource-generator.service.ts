import { Injectable } from '@nestjs/common';

@Injectable()
export class ResourceGeneratorService {
  generateQuickResources(topic: string, level?: string) {
    // Return a small resource bundle scaffold
    return {
      summary: `Resumen breve sobre ${topic} (nivel: ${level || 'estándar'}).`,
      flashcards: [
        { q: `¿Qué es ${topic}?`, a: `Definición breve de ${topic}.` },
      ],
      quiz: [
        { q: `Pregunta rápida sobre ${topic}`, choices: ['A', 'B', 'C', 'D'], answer: 'A' },
      ],
      plan: `Plan de estudio rápido para ${topic}: 3 pasos diarios.`,
    };
  }
}
