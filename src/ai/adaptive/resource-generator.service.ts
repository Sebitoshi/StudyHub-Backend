import { Injectable, Logger } from '@nestjs/common';
import { GeneratedResourcesService } from '../generated-resources/generated-resources.service';

@Injectable()
export class ResourceGeneratorService {
  private readonly logger = new Logger(ResourceGeneratorService.name);

  constructor(private readonly generated: GeneratedResourcesService) {}

  /**
   * Generate pedagogical resources (summary, flashcards, quiz, plan, examSim)
   * and persist them via GeneratedResourcesService. Returns an object with ids and content.
   */
  async generateAndPersistResources(userId: number, conversationId: any, topic: string, studentModel?: any, knowledgeGaps?: any[]) {
    // Create customized summary
    const summary = `Resumen específico sobre ${topic}. Nivel estimado: ${studentModel?.subjectLevels?.[topic] || 'general'}. Resumen enfocado en debilidades: ${(studentModel && studentModel.weaknesses && studentModel.weaknesses.includes(topic)) ? 'Sí' : 'No' }.`;

    // Simple flashcards generation (3 cards)
    const flashcards = [
      { q: `Define ${topic} en una frase.`, a: `Respuesta modelo para ${topic}.` },
      { q: `Menciona una aplicación práctica de ${topic}.`, a: `Aplicación ejemplo.` },
      { q: `Resolución breve de un caso simple de ${topic}.`, a: `Paso a paso corto.` },
    ];

    // Quiz: 3 MCQs scaffold
    const quiz = [
      { q: `Pregunta 1 sobre ${topic}`, choices: ['A','B','C','D'], answer: 'A' },
      { q: `Pregunta 2 sobre ${topic}`, choices: ['A','B','C','D'], answer: 'B' },
      { q: `Pregunta 3 sobre ${topic}`, choices: ['A','B','C','D'], answer: 'C' },
    ];

    const plan = {
      title: `Plan de estudio para ${topic}`,
      timeline: [
        { day: 1, tasks: ['Leer resumen', 'Revisar flashcards'] },
        { day: 2, tasks: ['Resolver quiz', 'Repasar errores'] },
      ],
    };

    // Exam simulation scaffold (short)
    const examSim = {
      title: `Simulacro de ${topic}`,
      sections: [{ name: 'Conceptos clave', questions: quiz }],
    };

    // Persist all resources
    const ids: any = {};
    try {
      ids.summary = await this.generated.saveResource(userId, conversationId, 'summary', `Resumen: ${topic}`, { summary });
      ids.flashcards = await this.generated.saveResource(userId, conversationId, 'flashcards', `Flashcards: ${topic}`, { flashcards });
      ids.quiz = await this.generated.saveResource(userId, conversationId, 'quiz', `Quiz: ${topic}`, { quiz });
      ids.plan = await this.generated.saveResource(userId, conversationId, 'study_plan', `Plan: ${topic}`, { plan });
      ids.examSim = await this.generated.saveResource(userId, conversationId, 'exam_simulation', `Simulacro: ${topic}`, { examSim });
    } catch (err) {
      this.logger.warn('Failed to persist generated resources: ' + err);
    }

    return { ids, content: { summary, flashcards, quiz, plan, examSim } };
  }

  // Backwards-compatible quick resources (non-persisted)
  generateQuickResources(topic: string, level?: string) {
    const summary = `Resumen breve sobre ${topic} (nivel: ${level || 'estándar'}).`;
    const flashcards = [
      { q: `¿Qué es ${topic}?`, a: `Definición breve de ${topic}.` },
      { q: `Menciona una aplicación de ${topic}.`, a: `Aplicación ejemplo.` },
    ];
    const quiz = [
      { q: `Pregunta rápida sobre ${topic}`, choices: ['A','B','C','D'], answer: 'A' },
    ];
    const plan = `Plan de estudio rápido para ${topic}: 3 pasos diarios.`;
    return { summary, flashcards, quiz, plan };
  }
}
