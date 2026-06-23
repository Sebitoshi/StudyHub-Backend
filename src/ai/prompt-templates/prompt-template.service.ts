import { Injectable, Logger } from '@nestjs/common';
import { PromptTemplateRepository } from './prompt-template.repository';

@Injectable()
export class PromptTemplateService {
  private readonly logger = new Logger(PromptTemplateService.name);

  // Default templates (fallbacks) useful for bootstrapping
  private defaults: Record<string, any> = {
    EXPLAIN_CONCEPT: { code: 'EXPLAIN_CONCEPT', name: 'Explicar concepto', prompt: 'Explica el concepto de forma clara, con ejemplos y una breve comprobación de comprensión al final.' },
    EXAM_PREPARATION: { code: 'EXAM_PREPARATION', name: 'Preparación examen', prompt: 'Actúa como preparador de exámenes: prioriza conceptos fundamentales, genera preguntas tipo examen y sugiere un plan de estudio rápido.' },
    HOMEWORK_HELP: { code: 'HOMEWORK_HELP', name: 'Ayuda tarea', prompt: 'Guía al estudiante paso a paso: da pistas y preguntas para llegar a la solución; no entregues la solución completa a menos que se solicite explícitamente.' },
    FLASHCARD_GENERATOR: { code: 'FLASHCARD_GENERATOR', name: 'Generador flashcards', prompt: 'Genera una lista de flashcards con pregunta y respuesta concisa para el tema indicado.' },
    SUMMARY: { code: 'SUMMARY', name: 'Resumen', prompt: 'Genera un resumen estructurado del tema con secciones y puntos clave.' },
  };

  constructor(private readonly repo: PromptTemplateRepository) {}

  async getByCode(code: string) {
    const db = await this.repo.findByCode(code);
    if (db) return db;
    return this.defaults[code] ?? null;
  }

  detectIntent(text: string) {
    const t = (text || '').toLowerCase();
    if (/exam|parcial|examen|simulacro|preparar/.test(t)) return this.defaults.EXAM_PREPARATION;
    if (/flashcard|flashcards|tarjetas|memorizar/.test(t)) return this.defaults.FLASHCARD_GENERATOR;
    if (/resumir|resumen|resuma|sintetiza|síntesis/.test(t)) return this.defaults.SUMMARY;
    if (/ayuda|tarea|deberes|ejercicio|problema|resolver/.test(t) && /\b(solucion|respuesta)\b/.test(t) === false) return this.defaults.HOMEWORK_HELP;
    if (/explica|qué es|que es|definición|definir|concepto|conceptual/.test(t)) return this.defaults.EXPLAIN_CONCEPT;
    if (/quiz|pregunta|preguntas|test|cuestionario/.test(t)) return this.defaults.EXAM_PREPARATION;
    // fallback: if user mentions study or prepare
    if (/estudiar|preparar|repasar/.test(t)) return this.defaults.EXAM_PREPARATION;
    return this.defaults.EXPLAIN_CONCEPT;
  }
}
