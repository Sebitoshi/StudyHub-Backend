import { Injectable, Logger } from '@nestjs/common';
import { TeacherProfileRepository } from './teacher-profile.repository';

@Injectable()
export class TeacherProfileService {
  private readonly logger = new Logger(TeacherProfileService.name);

  private defaultProfiles: Record<string, any> = {
    MATH_TEACHER: {
      code: 'MATH_TEACHER',
      name: 'Profesor de Matemáticas',
      description: 'Explica conceptos matemáticos paso a paso y detecta errores comunes.',
      subjects: ['matematica', 'matemáticas', 'álgebra', 'calculo', 'álgebra lineal', 'geometría'],
      systemPrompt: 'Eres un profesor de matemáticas: explica paso a paso, muestra procedimientos y detecta errores comunes.',
      teachingStyle: 'step_by_step',
      difficultyLevel: 'medium',
      active: true,
    },
    PHYSICS_TEACHER: {
      code: 'PHYSICS_TEACHER',
      name: 'Profesor de Física',
      description: 'Conecta conceptos físicos y explica con ejemplos y diagramas.',
      subjects: ['física', 'mecánica', 'termodinamica', 'electromagnetismo'],
      systemPrompt: 'Eres un profesor de física: explica el contexto, conecta eventos y usa ejemplos físicos.',
      teachingStyle: 'contextual',
      difficultyLevel: 'medium',
      active: true,
    },
    PROGRAMMING_TEACHER: {
      code: 'PROGRAMMING_TEACHER',
      name: 'Profesor de Programación',
      description: 'Explica lógica, buenas prácticas y arquitectura antes de código.',
      subjects: ['programacion', 'programación', 'java', 'python', 'javascript', 'node', 'spring', 'backend'],
      systemPrompt: 'Eres un profesor de programación: explica la lógica antes del código, promueve buenas prácticas y enseña arquitectura.',
      teachingStyle: 'explain_then_code',
      difficultyLevel: 'medium',
      active: true,
    },
    WRITING_TEACHER: {
      code: 'WRITING_TEACHER',
      name: 'Profesor de Escritura',
      description: 'Corrige estilo y estructura de textos.',
      subjects: ['redaccion', 'escritura', 'ensayo', 'writing'],
      systemPrompt: 'Eres un profesor de escritura: corrige gramática, estilo y propone mejoras.',
      teachingStyle: 'correction',
      difficultyLevel: 'low',
      active: true,
    },
    LANGUAGE_TEACHER: {
      code: 'LANGUAGE_TEACHER',
      name: 'Profesor de Idiomas',
      description: 'Corrige gramática y propone ejercicios.',
      subjects: ['ingles', 'español', 'idioma', 'language'],
      systemPrompt: 'Eres un profesor de idiomas: corrige gramática, explica errores y sugiere ejercicios.',
      teachingStyle: 'corrective',
      difficultyLevel: 'low',
      active: true,
    },
    HISTORY_TEACHER: {
      code: 'HISTORY_TEACHER',
      name: 'Profesor de Historia',
      description: 'Explica contexto histórico y líneas temporales.',
      subjects: ['historia', 'histórico', 'segunda guerra', 'segunda guerra mundial'],
      systemPrompt: 'Eres un profesor de historia: explica contexto, conecta eventos y usa líneas temporales.',
      teachingStyle: 'narrative',
      difficultyLevel: 'low',
      active: true,
    },
    SCIENCE_TEACHER: {
      code: 'SCIENCE_TEACHER',
      name: 'Profesor de Ciencias',
      description: 'Cubre conceptos científicos con ejemplos y experimentos simples.',
      subjects: ['ciencia', 'biologia', 'quimica', 'biología', 'química'],
      systemPrompt: 'Eres un profesor de ciencias: explica conceptos con ejemplos y experimentos simples.',
      teachingStyle: 'example_based',
      difficultyLevel: 'medium',
      active: true,
    },
    EXAM_COACH: {
      code: 'EXAM_COACH',
      name: 'Preparador de Exámenes',
      description: 'Prioriza preparación, genera simulacros y evalúa desempeño.',
      subjects: [],
      systemPrompt: 'Eres un entrenador de exámenes: prioriza preparación, genera simulacros y evalúa desempeño.',
      teachingStyle: 'exam_focused',
      difficultyLevel: 'high',
      active: true,
    },
  };

  constructor(private readonly repo: TeacherProfileRepository) {}

  async getByCode(code: string) {
    const db = await this.repo.findByCode(code);
    if (db) return db;
    return this.defaultProfiles[code] ?? null;
  }

  async detectProfile(message: string, academicContext: any) {
    const text = (message || '').toLowerCase();

    // Check academic subjects first
    if (academicContext?.subjects && academicContext.subjects.length) {
      for (const s of academicContext.subjects) {
        const name = (s.name || '').toLowerCase();
        if (text.includes(name)) {
          // map subject keywords to profiles
          if (['matematica', 'matemáticas', 'algebra', 'calculo', 'álgebra'].some((k) => name.includes(k))) return this.defaultProfiles.MATH_TEACHER;
          if (['física', 'fisica', 'mecanica', 'termodinamica'].some((k) => name.includes(k))) return this.defaultProfiles.PHYSICS_TEACHER;
          if (['programacion', 'programación', 'java', 'python', 'javascript', 'node', 'spring'].some((k) => name.includes(k))) return this.defaultProfiles.PROGRAMMING_TEACHER;
          if (['historia', 'segunda guerra', 'guerra mundial'].some((k) => name.includes(k))) return this.defaultProfiles.HISTORY_TEACHER;
        }
      }
    }

    // Rule-based detection from message
    if (/(derivad|integral|álgebra|matemát|cálcul)/i.test(text)) return this.defaultProfiles.MATH_TEACHER;
    if (/(física|electromagnet|mecánic|termodinami)/i.test(text)) return this.defaultProfiles.PHYSICS_TEACHER;
    if (/(java|python|javascript|programa|programaci|backend|spring|node)/i.test(text)) return this.defaultProfiles.PROGRAMMING_TEACHER;
    if (/(ensayo|redacción|escribir|tarea de escritura)/i.test(text)) return this.defaultProfiles.WRITING_TEACHER;
    if (/(inglés|español|idioma|gramática|vocabulario)/i.test(text)) return this.defaultProfiles.LANGUAGE_TEACHER;
    if (/(segunda guerra|guerra mundial|historia)/i.test(text)) return this.defaultProfiles.HISTORY_TEACHER;
    if (/(preparar|parcial|examen|simulacro|estoy preparand)/i.test(text)) return this.defaultProfiles.EXAM_COACH;
    if (/(biología|química|ciencia|experimento)/i.test(text)) return this.defaultProfiles.SCIENCE_TEACHER;

    // default to programming teacher if code-like, else exam coach
    if (/\b(code|function|class|var|let)\b/.test(text)) return this.defaultProfiles.PROGRAMMING_TEACHER;

    return this.defaultProfiles.EXAM_COACH;
  }
}
