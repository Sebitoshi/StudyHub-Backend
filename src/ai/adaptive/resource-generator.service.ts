import { Injectable, Logger } from '@nestjs/common';
import { GeneratedResourcesService } from '../generated-resources/generated-resources.service';
import { GroqService } from '../groq.service';

type ResourceType = 'SUMMARY' | 'FLASHCARDS' | 'QUIZ' | 'STUDY_PLAN' | 'EXAM_SIMULATION';

interface ResourceGenerationContext {
  topic: string;
  subject: string;
  trigger: string;
  sourceKnowledgeGap?: string | null;
  userMessage?: string;
  academicContext?: any;
  studentModel?: any;
  knowledgeGaps?: any[];
  learningGoals?: any[];
  teachingStrategy?: any;
  teacherProfile?: any;
}

@Injectable()
export class ResourceGeneratorService {
  private readonly logger = new Logger(ResourceGeneratorService.name);

  constructor(
    private readonly generated: GeneratedResourcesService,
    private readonly groq: GroqService,
  ) {}

  /**
   * Generate pedagogical resources via a single Groq call and persist them.
   */
  async generateAndPersistResources(userId: number, conversationId: any, options: ResourceGenerationContext) {
    const ctx = this.normalizeContext(options);
    const difficulty = this.resolveDifficulty(ctx.subject, ctx.studentModel, ctx.trigger);
    const generatedFrom = this.buildGeneratedFrom(ctx);

    try {
      const batch = await this.generateAllResourcesBatch(ctx, difficulty);
      const resourceTypes: ResourceType[] = ['SUMMARY', 'FLASHCARDS', 'QUIZ', 'STUDY_PLAN', 'EXAM_SIMULATION'];
      const saved: Array<{ key: string; id: string; type: string; title: string; difficulty: string }> = [];

      for (const type of resourceTypes) {
        const key = this.toKey(type);
        const generated = batch[key];
        if (!generated) continue;

        const meta = {
          subject: ctx.subject,
          sourceKnowledgeGap: ctx.sourceKnowledgeGap,
          trigger: ctx.trigger,
          difficulty,
          generatedFrom,
        };
        const id = await this.generated.saveResource(
          userId,
          conversationId,
          type,
          generated.title,
          generated.content,
          meta,
        );
        saved.push({
          key,
          id: String(id),
          type,
          title: generated.title,
          difficulty,
        });
      }

      const ids = Object.fromEntries(saved.map((item) => [item.key, item.id]));
      return {
        ids,
        resources: saved,
        subject: ctx.subject,
        sourceKnowledgeGap: ctx.sourceKnowledgeGap,
        difficulty,
        generatedFrom,
      };
    } catch (err) {
      this.logger.warn(`Batch resource generation failed, falling back to sequential: ${err}`);
      return this.generateAndPersistResourcesSequential(userId, conversationId, ctx, difficulty, generatedFrom);
    }
  }

  private async generateAndPersistResourcesSequential(
    userId: number,
    conversationId: any,
    ctx: ResourceGenerationContext,
    difficulty: string,
    generatedFrom: any,
  ) {
    const resourceTypes: ResourceType[] = ['SUMMARY', 'FLASHCARDS', 'QUIZ', 'STUDY_PLAN', 'EXAM_SIMULATION'];
    const results = await Promise.all(
      resourceTypes.map(async (type) => {
        try {
          const generated = await this.generateResource(type, ctx, difficulty);
          const meta = {
            subject: ctx.subject,
            sourceKnowledgeGap: ctx.sourceKnowledgeGap,
            trigger: ctx.trigger,
            difficulty,
            generatedFrom,
          };
          const id = await this.generated.saveResource(
            userId,
            conversationId,
            type,
            generated.title,
            generated.content,
            meta,
          );
          return {
            key: this.toKey(type),
            id: String(id),
            type,
            title: generated.title,
            difficulty,
          };
        } catch (err) {
          this.logger.warn(`Failed to generate ${type}: ${err}`);
          return null;
        }
      }),
    );

    const saved = results.filter(Boolean) as Array<{ key: string; id: string; type: string; title: string; difficulty: string }>;
    const ids = Object.fromEntries(saved.map((item) => [item.key, item.id]));

    return {
      ids,
      resources: saved,
      subject: ctx.subject,
      sourceKnowledgeGap: ctx.sourceKnowledgeGap,
      difficulty,
      generatedFrom,
    };
  }

  private async generateAllResourcesBatch(ctx: ResourceGenerationContext, difficulty: string) {
    const contextBlock = this.buildContextBlock(ctx, difficulty);
    const { data } = await this.groq.chatJson([
      {
        role: 'system',
        content: `Eres un diseñador instruccional universitario. Genera recursos académicos personalizados en español.
Responde SOLO con JSON válido, sin markdown ni texto adicional.
Debes devolver TODOS los recursos en una sola respuesta.`,
      },
      {
        role: 'user',
        content: `${contextBlock}

TAREA: Genera en una sola respuesta JSON los 5 recursos pedagógicos para "${ctx.topic}" en ${ctx.subject}.

Incluye:
1. summary: resumen condensado con sections, keyTakeaways y commonMistakes
2. flashcards: entre 6 y 12 tarjetas pregunta/respuesta
3. quiz: entre ${this.quizCount(difficulty)} preguntas de opción múltiple con explicación
4. studyPlan: plan por días con estimatedHours, tasks y focus
5. examSimulation: simulacro con durationMinutes, instructions y sections

Prioriza knowledge gaps, debilidades y metas del estudiante.

Formato JSON exacto:
${this.batchJsonSchema()}`,
      },
    ]);

    return {
      summary: {
        title: data.summary?.title || this.defaultTitle('SUMMARY', ctx.topic),
        content: this.normalizeContent('SUMMARY', data.summary || {}, ctx),
      },
      flashcards: {
        title: data.flashcards?.title || this.defaultTitle('FLASHCARDS', ctx.topic),
        content: this.normalizeContent('FLASHCARDS', data.flashcards || {}, ctx),
      },
      quiz: {
        title: data.quiz?.title || this.defaultTitle('QUIZ', ctx.topic),
        content: this.normalizeContent('QUIZ', data.quiz || {}, ctx),
      },
      studyPlan: {
        title: data.studyPlan?.title || this.defaultTitle('STUDY_PLAN', ctx.topic),
        content: this.normalizeContent('STUDY_PLAN', data.studyPlan || {}, ctx),
      },
      examSimulation: {
        title: data.examSimulation?.title || this.defaultTitle('EXAM_SIMULATION', ctx.topic),
        content: this.normalizeContent('EXAM_SIMULATION', data.examSimulation || {}, ctx),
      },
    };
  }

  private batchJsonSchema(): string {
    return `{
  "summary": {"title":"...","sections":[{"heading":"...","content":"..."}],"keyTakeaways":["..."],"commonMistakes":["..."]},
  "flashcards": {"title":"...","cards":[{"question":"...","answer":"...","focusGap":"..."}]},
  "quiz": {"title":"...","questions":[{"question":"...","choices":["A","B","C","D"],"answer":"...","explanation":"...","difficulty":"easy|medium|hard"}]},
  "studyPlan": {"title":"...","totalEstimatedHours":number,"intensity":"regular|intensivo","priorityTopics":["..."],"schedule":[{"day":1,"estimatedHours":number,"tasks":["..."],"focus":"..."}]},
  "examSimulation": {"title":"...","durationMinutes":number,"instructions":"...","sections":[{"name":"...","questions":[{"question":"...","type":"open_answer|short_answer|problem|multiple_choice","points":number,"expectedAnswer":"..."}]}]}
}`;
  }

  /** @deprecated Use generateAndPersistResources for real Groq content. */
  generateQuickResources(topic: string, level?: string) {
    return {
      summary: `Recursos en generación para ${topic} (nivel: ${level || 'estándar'}).`,
      flashcards: [],
      quiz: [],
      plan: `Plan de estudio para ${topic} en preparación.`,
    };
  }

  private normalizeContext(options: ResourceGenerationContext): ResourceGenerationContext {
    const topic = options.topic || options.subject || options.userMessage || 'tema académico';
    const subject = options.subject || this.inferSubject(topic, options.studentModel, options.knowledgeGaps) || 'general';
    return {
      ...options,
      topic,
      subject,
      trigger: options.trigger || 'ADAPTIVE',
      sourceKnowledgeGap: options.sourceKnowledgeGap || this.firstGapId(options.knowledgeGaps),
      knowledgeGaps: options.knowledgeGaps || [],
      learningGoals: options.learningGoals || [],
    };
  }

  private async generateResource(type: ResourceType, ctx: ResourceGenerationContext, difficulty: string) {
    const contextBlock = this.buildContextBlock(ctx, difficulty);
    const spec = this.resourceSpec(type, ctx, difficulty);

    const { data } = await this.groq.chatJson([
      {
        role: 'system',
        content: `Eres un diseñador instruccional universitario. Genera recursos académicos personalizados en español.
Responde SOLO con JSON válido, sin markdown ni texto adicional.
El contenido debe ser específico para la materia y el nivel del estudiante, no genérico.`,
      },
      {
        role: 'user',
        content: `${contextBlock}

TAREA: Genera un recurso de tipo ${type}.
${spec}

Formato JSON esperado:
${this.jsonSchema(type)}`,
      },
    ]);

    return {
      title: data.title || this.defaultTitle(type, ctx.topic),
      content: this.normalizeContent(type, data, ctx),
    };
  }

  private buildContextBlock(ctx: ResourceGenerationContext, difficulty: string): string {
    const sm = ctx.studentModel || {};
    const gaps = (ctx.knowledgeGaps || []).slice(0, 8).map((g) => `- ${g.topic || g.subject} (${g.subject || 'general'}, confianza: ${g.confidence ?? '?'})`);
    const goals = (ctx.learningGoals || []).slice(0, 5).map((g) => `- ${g.title} (${g.progress ?? 0}% progreso)`);
    const weaknesses = [...(sm.weaknesses || []), ...(sm.recurringMistakes || [])].slice(0, 6);
    const strengths = (sm.strengths || []).slice(0, 5);
    const subjectLevel = sm.subjectLevels?.[ctx.subject] || difficulty;

    const academic = ctx.academicContext || {};
    const subjects = (academic.subjects || []).slice(0, 6).map((s: any) => s.name).filter(Boolean);
    const pendingTasks = (academic.pendingTasks || []).slice(0, 4).map((t: any) => t.title).filter(Boolean);

    const strategy = ctx.teachingStrategy || {};
    const triggers = (strategy.triggers || []).map((t: any) => t.type).join(', ');
    const teacher = ctx.teacherProfile || {};

    return [
      `TEMA: ${ctx.topic}`,
      `MATERIA: ${ctx.subject}`,
      `TRIGGER: ${ctx.trigger}`,
      `MENSAJE DEL ESTUDIANTE: ${ctx.userMessage || ctx.topic}`,
      `DIFICULTAD OBJETIVO: ${difficulty}`,
      `NIVEL EN MATERIA: ${subjectLevel}`,
      `MODO PEDAGÓGICO: ${strategy.mode || 'GUIDED'}`,
      `TRIGGERS DETECTADOS: ${triggers || ctx.trigger}`,
      `PERFIL DOCENTE: ${teacher.name || teacher.code || 'Profesor IA general'}`,
      `ESTILO DOCENTE: ${teacher.teachingStyle || teacher.systemPrompt?.slice(0, 120) || 'pedagógico adaptativo'}`,
      `CARRERA/SEMESTRE: ${academic.career || 'N/A'} / ${academic.semester || 'N/A'}`,
      `MATERIAS DEL ESTUDIANTE: ${subjects.join(', ') || 'general'}`,
      `TAREAS PENDIENTES: ${pendingTasks.join(', ') || 'ninguna'}`,
      `FORTALEZAS: ${strengths.join(', ') || 'por determinar'}`,
      `DEBILIDADES: ${weaknesses.join(', ') || 'por determinar'}`,
      `VELOCIDAD DE COMPRENSIÓN: ${sm.comprehensionSpeed || 'NORMAL'}`,
      `CONFIANZA POR MATERIA: ${JSON.stringify(sm.confidencePerSubject || {})}`,
      `KNOWLEDGE GAPS:`,
      gaps.length ? gaps.join('\n') : '- ninguno detectado',
      `METAS DE APRENDIZAJE:`,
      goals.length ? goals.join('\n') : '- ninguna meta activa',
    ].join('\n');
  }

  private resourceSpec(type: ResourceType, ctx: ResourceGenerationContext, difficulty: string): string {
    const isExam = ctx.trigger === 'EXAM_MODE';
    const gapTopics = (ctx.knowledgeGaps || []).map((g) => g.topic).filter(Boolean).slice(0, 5);

    switch (type) {
      case 'SUMMARY':
        return `Crea un resumen condensado y pedagógico sobre "${ctx.topic}" en ${ctx.subject}.
Adapta la profundidad al nivel ${difficulty}. Incluye definiciones clave, relaciones entre conceptos, pasos/procedimientos y errores frecuentes del estudiante.
${gapTopics.length ? `Prioriza estos gaps: ${gapTopics.join(', ')}.` : ''}`;

      case 'FLASHCARDS':
        return `Genera entre 6 y 12 flashcards (pregunta/respuesta) sobre "${ctx.topic}" en ${ctx.subject}.
Cada tarjeta debe atacar un knowledge gap o debilidad detectada. Respuestas concisas pero completas.`;

      case 'QUIZ':
        return `Genera entre ${this.quizCount(difficulty)} preguntas de opción múltiple sobre "${ctx.topic}" en ${ctx.subject}.
Dificultad adaptativa: ${difficulty}. Incluye explicación breve de la respuesta correcta.
Varía tipos: conceptual, aplicación, procedimiento y detección de errores.`;

      case 'STUDY_PLAN':
        return `Diseña un plan de estudio ${isExam ? 'intensivo (examen próximo)' : 'regular'} para "${ctx.topic}" en ${ctx.subject}.
Incluye horas estimadas por sesión, priorización por debilidades y metas activas del estudiante.
Estructura por días con tareas concretas y duración en horas.`;

      case 'EXAM_SIMULATION':
        return `Crea un simulacro completo de evaluación sobre "${ctx.topic}" en ${ctx.subject}.
Incluye preguntas similares a un examen real universitario: abiertas, cortas y de problema.
${isExam ? 'Modo examen: mayor densidad, tiempo sugerido y criterios de evaluación.' : ''}
Prioriza gaps y debilidades del estudiante.`;

      default:
        return '';
    }
  }

  private jsonSchema(type: ResourceType): string {
    const schemas: Record<ResourceType, string> = {
      SUMMARY: `{"title":"...","sections":[{"heading":"...","content":"..."}],"keyTakeaways":["..."],"commonMistakes":["..."]}`,
      FLASHCARDS: `{"title":"...","cards":[{"question":"...","answer":"...","focusGap":"..."}]}`,
      QUIZ: `{"title":"...","questions":[{"question":"...","choices":["A","B","C","D"],"answer":"...","explanation":"...","difficulty":"easy|medium|hard"}]}`,
      STUDY_PLAN: `{"title":"...","totalEstimatedHours":number,"intensity":"regular|intensivo","priorityTopics":["..."],"schedule":[{"day":1,"estimatedHours":number,"tasks":["..."],"focus":"..."}]}`,
      EXAM_SIMULATION: `{"title":"...","durationMinutes":number,"instructions":"...","sections":[{"name":"...","questions":[{"question":"...","type":"open_answer|short_answer|problem|multiple_choice","points":number,"expectedAnswer":"..."}]}]}`,
    };
    return schemas[type];
  }

  private normalizeContent(type: ResourceType, data: any, ctx: ResourceGenerationContext) {
    switch (type) {
      case 'SUMMARY':
        return {
          type,
          topic: ctx.topic,
          subject: ctx.subject,
          sections: data.sections || [],
          keyTakeaways: data.keyTakeaways || [],
          commonMistakes: data.commonMistakes || [],
        };
      case 'FLASHCARDS':
        return {
          type,
          topic: ctx.topic,
          subject: ctx.subject,
          flashcards: data.cards || data.flashcards || [],
        };
      case 'QUIZ':
        return {
          type,
          topic: ctx.topic,
          subject: ctx.subject,
          quiz: data.questions || data.quiz || [],
        };
      case 'STUDY_PLAN':
        return {
          type,
          topic: ctx.topic,
          subject: ctx.subject,
          totalEstimatedHours: data.totalEstimatedHours || null,
          intensity: data.intensity || (ctx.trigger === 'EXAM_MODE' ? 'intensivo' : 'regular'),
          priorityTopics: data.priorityTopics || [],
          timeline: data.schedule || data.timeline || [],
        };
      case 'EXAM_SIMULATION':
        return {
          type,
          topic: ctx.topic,
          subject: ctx.subject,
          durationMinutes: data.durationMinutes || 60,
          instructions: data.instructions || '',
          sections: data.sections || [],
        };
      default:
        return data;
    }
  }

  private buildGeneratedFrom(ctx: ResourceGenerationContext) {
    return {
      trigger: ctx.trigger,
      topic: ctx.topic,
      subject: ctx.subject,
      sourceKnowledgeGap: ctx.sourceKnowledgeGap || null,
      teachingMode: ctx.teachingStrategy?.mode || null,
      teachingTriggers: (ctx.teachingStrategy?.triggers || []).map((t: any) => t.type),
      teacherProfile: ctx.teacherProfile?.code || ctx.teacherProfile?.name || null,
      studentLevel: ctx.studentModel?.subjectLevels?.[ctx.subject] || null,
      comprehensionSpeed: ctx.studentModel?.comprehensionSpeed || null,
    };
  }

  private resolveDifficulty(subject: string, studentModel?: any, trigger?: string) {
    const level = studentModel?.subjectLevels?.[subject] || studentModel?.academicLevel || 'INTERMEDIATE';
    if (trigger === 'EXAM_MODE') {
      if (level === 'BEGINNER') return 'INTERMEDIATE';
      return level;
    }
    return level;
  }

  private quizCount(difficulty: string) {
    if (difficulty === 'BEGINNER') return '5 a 7';
    if (difficulty === 'ADVANCED') return '11 a 15';
    return '8 a 10';
  }

  private inferSubject(topic: string, studentModel?: any, knowledgeGaps?: any[]) {
    const matchingGap = (knowledgeGaps || []).find((gap) => topic && (gap.topic === topic || gap.subject === topic));
    if (matchingGap?.subject) return matchingGap.subject;
    const subjects = Object.keys(studentModel?.subjectLevels || {});
    return subjects.find((subject) => topic?.toLowerCase?.().includes(subject.toLowerCase())) || subjects[0];
  }

  private firstGapId(knowledgeGaps?: any[]) {
    const gap = (knowledgeGaps || [])[0];
    return gap?._id ? String(gap._id) : gap?.id ? String(gap.id) : null;
  }

  private defaultTitle(type: ResourceType, topic: string) {
    const map: Record<ResourceType, string> = {
      SUMMARY: `Resumen: ${topic}`,
      FLASHCARDS: `Flashcards: ${topic}`,
      QUIZ: `Quiz: ${topic}`,
      STUDY_PLAN: `Plan de estudio: ${topic}`,
      EXAM_SIMULATION: `Simulacro: ${topic}`,
    };
    return map[type];
  }

  private toKey(type: ResourceType) {
    const map: Record<ResourceType, string> = {
      SUMMARY: 'summary',
      FLASHCARDS: 'flashcards',
      QUIZ: 'quiz',
      STUDY_PLAN: 'studyPlan',
      EXAM_SIMULATION: 'examSimulation',
    };
    return map[type];
  }
}
