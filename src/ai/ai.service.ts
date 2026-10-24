import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { Collection, ObjectId } from 'mongodb';
import { CONVERSATIONS_COLLECTION, MESSAGES_COLLECTION } from './mongo.provider';
import { GroqService } from './groq.service';
import { PromptBuilderService } from './context/prompt-builder.service';
import { AcademicContextService } from './context/academic-context.service';
import { TeacherProfileService } from './teacher-profiles/teacher-profile.service';
import { MemoryService } from './memory/memory.service';
import { PromptTemplateService } from './prompt-templates/prompt-template.service';
import { LearningAnalyticsService } from './learning-analytics/learning-analytics.service';
import { KnowledgeGapsService } from './knowledge-gaps/knowledge-gaps.service';
import { AdaptiveLearningService } from './adaptive/adaptive-learning.service';
import { StudentModelService } from './student-models/student-model.service';
import { GeneratedResourcesService } from './generated-resources/generated-resources.service';
import { AdaptiveSessionsService } from './adaptive/adaptive-sessions.service';
import { ResourceGeneratorService } from './adaptive/resource-generator.service';
import { LearningGoalsService } from './learning-goals/learning-goals.service';
import {
  ImageAnalysisResult,
  ImageAnalysisService,
} from './image-analysis.service';

/** Máximo de caracteres del material de imagen que se inyecta al profesor. */
const MAX_IMAGE_MATERIAL_CHARS = 6000;
/** Máximo de caracteres del resumen de imagen que queda en el historial. */
const MAX_IMAGE_DIGEST_CHARS = 1800;

function truncateText(text: string, max: number): string {
  const clean = String(text || '').trim();
  return clean.length > max ? `${clean.slice(0, max).trim()}…` : clean;
}

/**
 * Material completo que recibe el profesor en el turno actual. Incluye la
 * instrucción pedagógica: usar el análisis para enseñar, no para transcribir.
 */
function formatImageMaterial(analysis: ImageAnalysisResult): string {
  const c = analysis.contenido;
  const p = analysis.promptInterno;
  const d = analysis.detalle;

  const lines: string[] = [
    'El estudiante adjuntó una imagen y el sistema ya la analizó en tres fases.',
    'Usa este material para ENSEÑAR (explicar, conectar, comprobar comprensión), no para transcribirlo tal cual.',
    'Si contiene un ejercicio y el estudiante no pidió la solución, guía con preguntas y pistas.',
    '',
    `IMAGEN: ${analysis.filename || 'imagen'}`,
    `Título: ${c.titulo} · Tipo: ${c.tipoContenido} · Tema: ${c.tema} · Nivel: ${c.nivelDificultad}`,
    '',
    'CONTENIDO PRINCIPAL (fase 1):',
    truncateText(c.contenidoPrincipal, 2200),
  ];

  if (c.textoDetectado) {
    lines.push('', 'TEXTO DETECTADO:', truncateText(c.textoDetectado, 1400));
  }
  if (c.elementosClave.length) {
    lines.push('', 'ELEMENTOS CLAVE: ' + c.elementosClave.join('; '));
  }
  if (p.promptInterno) {
    lines.push('', 'PROMPT INTERNO (fase 2, guía de análisis):', truncateText(p.promptInterno, 700));
  }
  if (p.preguntasGuia.length) {
    lines.push('', 'PREGUNTAS GUÍA: ' + p.preguntasGuia.join(' | '));
  }

  lines.push('', 'DETALLE YA ELABORADO (fase 3):');
  if (d.resumen) lines.push('Resumen: ' + d.resumen);
  if (d.ideasClave.length) lines.push('Ideas clave: ' + d.ideasClave.join('; '));
  if (d.conceptos.length) {
    lines.push(
      'Conceptos: ' +
        d.conceptos.map((x) => `${x.termino}: ${x.definicion}`).join(' | '),
    );
  }
  if (d.explicacionPasoAPaso.length) {
    lines.push('Pasos: ' + d.explicacionPasoAPaso.join(' | '));
  }
  if (d.vacios.length) lines.push('Vacíos detectados: ' + d.vacios.join(' | '));

  return truncateText(lines.join('\n'), MAX_IMAGE_MATERIAL_CHARS);
}

/** Resumen compacto que se guarda en el historial para los turnos siguientes. */
function formatImageDigest(analysis: ImageAnalysisResult): string {
  const c = analysis.contenido;
  const d = analysis.detalle;

  const parts = [
    `Título: ${c.titulo} | Tema: ${c.tema} | Tipo: ${c.tipoContenido}`,
    c.contenidoPrincipal
      ? `Contenido: ${truncateText(c.contenidoPrincipal, 800)}`
      : '',
    d.resumen ? `Resumen: ${truncateText(d.resumen, 400)}` : '',
    d.ideasClave.length ? `Ideas clave: ${d.ideasClave.slice(0, 8).join('; ')}` : '',
    d.conceptos.length
      ? `Conceptos: ${d.conceptos
          .slice(0, 8)
          .map((x) => `${x.termino}: ${x.definicion}`)
          .join(' | ')}`
      : '',
    d.explicacionPasoAPaso.length
      ? `Pasos: ${d.explicacionPasoAPaso.slice(0, 8).join(' | ')}`
      : '',
  ].filter(Boolean);

  return truncateText(parts.join('\n'), MAX_IMAGE_DIGEST_CHARS);
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    @Inject(CONVERSATIONS_COLLECTION) private conversations: Collection,
    @Inject(MESSAGES_COLLECTION) private messages: Collection,
    private readonly groq: GroqService,
    private readonly promptBuilder: PromptBuilderService,
    private readonly memoryService: MemoryService,
    private readonly academicService: AcademicContextService,
    private readonly teacherProfileService: TeacherProfileService,
    private readonly promptTemplateService: PromptTemplateService,
    private readonly learningAnalyticsService: LearningAnalyticsService,
    private readonly knowledgeGapsService: KnowledgeGapsService,
    private readonly adaptiveLearningService: AdaptiveLearningService,
    private readonly studentModelService: StudentModelService,
    private readonly generatedResourcesService: GeneratedResourcesService,
    private readonly adaptiveSessionsService: AdaptiveSessionsService,
    private readonly learningGoalsService: LearningGoalsService,
    private readonly resourceGenerator: ResourceGeneratorService,
    private readonly imageAnalysis: ImageAnalysisService,
  ) {}

  async ensureConversation(userId: number, conversationId?: string) {
    if (conversationId) {
      try {
        const conv = await this.conversations.findOne({ _id: new ObjectId(conversationId) });
        if (conv) return conv;
      } catch (err) {
        // ignore invalid id and create new conversation
      }
    }

    const now = new Date();
    const res = await this.conversations.insertOne({
      userId,
      title: null,
      description: null,
      lastMessageAt: now,
      messageCount: 0,
      isPinned: false,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    });

    return await this.conversations.findOne({ _id: res.insertedId });
  }

  async chat(userId: number, conversationId: string | undefined, message: string, teacherId?: string) {
    const conv = await this.ensureConversation(userId, conversationId);
    if (!conv) throw new Error('Failed to create or fetch conversation');

    const sessionStartedAt = new Date();
    await this.persistUserMessage(conv._id, userId, message);

    const prep = await this.prepareInteraction(userId, conv._id, message, sessionStartedAt);
    const messagesForModel = await this.buildModelPrompt(userId, prep, message);

    const response = await this.groq.chat(messagesForModel);
    await this.persistAssistantMessage(conv._id, userId, response.content, response.tokensUsed, response.model);
    await this.autoGenerateTitle(conv, message);

    await this.finalizeInteraction(userId, conv._id, message, prep, sessionStartedAt);

    return { conversationId: conv._id, reply: response.content };
  }

  /**
   * Conversa con el Profesor IA usando una imagen ya analizada en tres fases.
   * La imagen no se reenvía: se guarda un resumen del análisis como adjunto del
   * mensaje (para los turnos siguientes) y se inyecta el material completo en el
   * prompt del turno actual.
   */
  async chatWithImage(
    userId: number,
    conversationId: string | undefined,
    question: string | undefined,
    teacherId: string | undefined,
    raw: {
      filename?: string;
      contenido: Record<string, any>;
      promptInterno: Record<string, any>;
      detalle: Record<string, any>;
    },
  ) {
    const conv = await this.ensureConversation(userId, conversationId);
    if (!conv) throw new Error('Failed to create or fetch conversation');

    const analysis: ImageAnalysisResult = {
      filename: (raw.filename || 'imagen').slice(0, 300),
      contenido: this.imageAnalysis.normalizeContent(raw.contenido),
      promptInterno: this.imageAnalysis.normalizeInternalPrompt(raw.promptInterno),
      detalle: this.imageAnalysis.normalizeDetail(raw.detalle),
    };

    const userText =
      (question || '').trim() || 'Explícame esta imagen y ayúdame a entenderla.';
    const sessionStartedAt = new Date();

    const attachment = {
      type: 'image-analysis',
      filename: analysis.filename,
      titulo: analysis.contenido.titulo,
      tema: analysis.contenido.tema,
      digest: formatImageDigest(analysis),
      createdAt: new Date(),
    };
    await this.persistUserMessage(conv._id, userId, userText, [attachment]);

    const prep = await this.prepareInteraction(userId, conv._id, userText, sessionStartedAt);
    const messagesForModel = await this.buildModelPrompt(
      userId,
      prep,
      userText,
      formatImageMaterial(analysis),
    );

    let response: { content: string; tokensUsed?: number; model?: string };
    try {
      response = await this.chatForProfessor(messagesForModel);
    } catch (err) {
      this.logger.error('Professor image reply failed: ' + err);
      throw new ServiceUnavailableException(
        'El profesor no pudo responder con la imagen en este momento. Inténtalo de nuevo en unos segundos.',
      );
    }
    await this.persistAssistantMessage(conv._id, userId, response.content, response.tokensUsed, response.model);
    await this.autoGenerateTitle(conv, userText);

    await this.finalizeInteraction(userId, conv._id, userText, prep, sessionStartedAt);

    return {
      conversationId: conv._id,
      reply: response.content,
      imageAnalysis: {
        titulo: analysis.contenido.titulo,
        tema: analysis.contenido.tema,
        resumen: analysis.detalle.resumen,
      },
    };
  }

  async streamChat(
    userId: number,
    conversationId: string | undefined,
    message: string,
    teacherId: string | undefined,
    onChunk: (chunk: string) => Promise<void> | void,
  ) {
    const conv = await this.ensureConversation(userId, conversationId);
    if (!conv) throw new Error('Failed to create or fetch conversation');

    const sessionStartedAt = new Date();
    await this.persistUserMessage(conv._id, userId, message);

    const prep = await this.prepareInteraction(userId, conv._id, message, sessionStartedAt);
    const messagesForModel = await this.buildModelPrompt(userId, prep, message);

    let finalContent = '';
    const usedStream = await this.groq.stream(messagesForModel, async (chunk: string) => {
      finalContent += chunk;
      await onChunk(chunk);
    });

    if (!usedStream) {
      const response = await this.groq.chat(messagesForModel);
      finalContent = response.content;
      await onChunk(finalContent);
    }

    await this.persistAssistantMessage(conv._id, userId, finalContent, null, process.env.GROQ_MODEL || null);
    await this.autoGenerateTitle(conv, message);

    await this.finalizeInteraction(userId, conv._id, message, prep, sessionStartedAt);

    return { conversationId: conv._id, reply: finalContent };
  }

  /**
   * Respuesta del profesor cuando enseña a partir de una imagen.
   *
   * Las tres fases de la imagen ya consumieron la cuota de tokens de salida por
   * minuto (OTPM) del modelo multimodal. Para no chocar con ese límite se usa un
   * modelo de texto (`GROQ_CHAT_MODEL`, por defecto `openai/gpt-oss-120b`) y, si
   * no está disponible o está limitado, se reintenta con el modelo por defecto.
   */
  private async chatForProfessor(messages: any[]) {
    const fallbackModel = (process.env.GROQ_MODEL || 'openai/gpt-oss-120b').trim();
    const preferredModel = (process.env.GROQ_CHAT_MODEL || 'openai/gpt-oss-120b').trim();
    const options = { maxTokens: 900 };

    try {
      return await this.groq.chat(messages, { ...options, model: preferredModel });
    } catch (err: any) {
      const status = err?.status ?? err?.response?.status;
      const message = String(err?.message || '');
      const rateLimited = status === 429 || /rate_limit|429/.test(message);
      const unavailable =
        status === 404 ||
        /model_not_found|not found|decommissioned|does not exist/i.test(message);

      if (!rateLimited && !unavailable) throw err;

      this.logger.warn(
        `El modelo ${preferredModel} no pudo responder (${status || 'sin estado'}); ` +
          `reintentando con ${fallbackModel}`,
      );
      // La ventana de OTPM se reinicia en ~12 s según las cabeceras de Groq.
      if (rateLimited) await new Promise((resolve) => setTimeout(resolve, 13000));
      return this.groq.chat(messages, { ...options, model: fallbackModel });
    }
  }

  private async persistUserMessage(
    conversationId: any,
    userId: number,
    message: string,
    attachments: any[] = [],
  ) {
    const userMsg = {
      conversationId,
      userId,
      role: 'user',
      content: message,
      tokensUsed: null,
      model: null,
      attachments,
      createdAt: new Date(),
    };

    await this.messages.insertOne(userMsg);
    await this.conversations.updateOne({ _id: conversationId }, { $inc: { messageCount: 1 }, $set: { lastMessageAt: new Date() } });
  }

  private async persistAssistantMessage(conversationId: any, userId: number, content: string, tokensUsed?: number | null, model?: string | null) {
    const assistantMsg = {
      conversationId,
      userId,
      role: 'assistant',
      content,
      tokensUsed: tokensUsed || 0,
      model: model || process.env.GROQ_MODEL || null,
      attachments: [],
      createdAt: new Date(),
    };

    await this.messages.insertOne(assistantMsg);
    await this.conversations.updateOne({ _id: conversationId }, { $inc: { messageCount: 1 }, $set: { lastMessageAt: new Date() } });
  }

  private async prepareInteraction(userId: number, conversationId: any, message: string, sessionStartedAt: Date) {
    const academicContext = await this.academicService.buildAcademicContext(userId);
    const teacherProfile = await this.teacherProfileService.detectProfile(message, academicContext);
    const promptTemplate = this.promptTemplateService.detectIntent(message);

    const detectedSubject = this.detectSubjectFromMessage(message, academicContext);
    await this.learningAnalyticsService.recordQuestion(userId, detectedSubject);

    const historyCursor = this.messages.find({ conversationId }).sort({ createdAt: 1 }).limit(50);
    const history = await historyCursor.toArray();
    const conversationContext = history.map((m) => {
      const imageDigest = this.imageAttachmentDigest(m);
      return {
        role: m.role,
        content: imageDigest
          ? `${m.content}\n\n[Imagen adjunta analizada en 3 fases]\n${imageDigest}`
          : m.content,
      };
    });

    const memories: any = await this.memoryService.getRelevantMemories(userId, message, 10);

    try {
      await this.knowledgeGapsService.detectAndUpsertGaps(userId, academicContext, {
        message,
        conversationId: String(conversationId),
      });
    } catch (err) {
      this.logger.warn('Knowledge gap detection failed: ' + err);
    }
    const knowledgeGaps = await this.knowledgeGapsService.getTopGaps(userId, 5);

    const analytics = await this.learningAnalyticsService.getAnalytics(userId);
    const currentStudentModel = await this.resolveStudentModel(userId, academicContext, memories, analytics);

    const adaptive = this.adaptiveLearningService.analyze(message, academicContext, memories, analytics, knowledgeGaps, currentStudentModel);

    let generatedResourceIds: string[] = [];
    let learningGoals: any[] = [];
    try {
      learningGoals = await this.learningGoalsService.listGoals(userId);
    } catch (err) {
      this.logger.warn('Learning goals retrieval failed: ' + err);
    }

    if (adaptive?.triggers?.length) {
      try {
        const generated = await this.adaptiveLearningService.generateAutomaticResources(
          userId,
          conversationId,
          adaptive,
          message,
          academicContext,
          currentStudentModel,
          knowledgeGaps,
          { learningGoals, teacherProfile },
        );
        generatedResourceIds = Object.values(generated?.ids || {}).map((id) => String(id));
      } catch (err) {
        this.logger.warn('Automatic resource generation failed: ' + err);
      }
    }

    return {
      academicContext,
      teacherProfile,
      promptTemplate,
      conversationContext,
      memories,
      knowledgeGaps,
      analytics,
      currentStudentModel,
      adaptive,
      generatedResourceIds,
      learningGoals,
      sessionStartedAt,
    };
  }

  private async buildModelPrompt(
    userId: number,
    prep: any,
    message: string,
    attachmentsContext?: string,
  ) {
    const memForPrompt = (prep.memories || []).map((m: any) => ({
      type: String(m.type || ''),
      key: String(m.key || m.type || ''),
      value: String(m.value || ''),
    }));
    const gapsForPrompt = (prep.knowledgeGaps || []).map((g: any) => ({
      topic: String(g.topic || g.name || ''),
      subject: g.subject,
      confidence: g.confidence,
      status: g.status,
    }));

    return this.promptBuilder.buildPrompt(
      userId,
      prep.conversationContext,
      message,
      memForPrompt,
      prep.teacherProfile,
      prep.promptTemplate,
      gapsForPrompt,
      prep.currentStudentModel,
      prep.adaptive,
      attachmentsContext,
    );
  }

  /** Resumen de las imágenes ya analizadas que viaja en el historial. */
  private imageAttachmentDigest(message: any): string {
    if (!Array.isArray(message?.attachments)) return '';
    return message.attachments
      .filter((attachment: any) => attachment?.type === 'image-analysis')
      .map((attachment: any) => String(attachment.digest || '').trim())
      .filter(Boolean)
      .join('\n\n');
  }

  private async finalizeInteraction(userId: number, conversationId: any, message: string, prep: any, sessionStartedAt: Date) {
    const sessionEndedAt = new Date();
    let historyAll: any[] = [];

    try {
      const historyAllCursor = this.messages.find({ conversationId }).sort({ createdAt: 1 }).limit(100);
      historyAll = await historyAllCursor.toArray();
      const convoMessages = historyAll.map((m) => ({ role: m.role, content: m.content }));
      await this.memoryService.analyzeAndStore(userId, convoMessages, prep.academicContext);
    } catch (err) {
      this.logger.warn('Memory analysis failed: ' + err);
    }

    let beforeSnapshot: any = prep.currentStudentModel;
    let updatedModel: any = null;
    let learningGoalProgress: any[] = [];
    let generatedResources: any[] = [];

    try {
      const analytics = await this.learningAnalyticsService.getAnalytics(userId);
      const memoriesAll = await this.memoryService.getUserMemories(userId);
      const knowledgeGaps = await this.knowledgeGapsService.getTopGaps(userId, 50);
      const recentTexts = historyAll.filter((m) => m.role === 'user').map((m) => m.content || '');
      const recurringMistakes = (memoriesAll || []).filter((m) => ['RECURRING_MISTAKE', 'WEAK_SKILL'].includes(m.type));

      try {
        generatedResources = await this.generatedResourcesService.listForUser(userId);
      } catch (err) {
        // ignore generated resources retrieval
      }

      beforeSnapshot = await this.studentModelService.get(userId);
      updatedModel = await this.studentModelService.updateFromSignals(
        userId,
        prep.academicContext,
        analytics,
        memoriesAll,
        knowledgeGaps,
        recentTexts,
        recurringMistakes,
        generatedResources,
        historyAll,
      );

      const adaptiveSessions = await this.adaptiveSessionsService.listForUser(userId, 10);
      learningGoalProgress = await this.learningGoalsService.updateProgressFromSignals(userId, {
        studentModel: updatedModel,
        analytics,
        knowledgeGaps,
        adaptiveSessions,
        generatedResources,
      });
    } catch (err) {
      this.logger.warn('Student model / learning goals update failed: ' + err);
    }

    try {
      await this.adaptiveSessionsService.logSession(
        userId,
        conversationId,
        {
          startedAt: sessionStartedAt,
          endedAt: sessionEndedAt,
          teacherProfile: prep.teacherProfile?.code || null,
          promptTemplate: prep.promptTemplate?.code || null,
          adaptive: prep.adaptive || null,
          teachingStrategy: prep.adaptive?.mode || null,
          learningGoalProgress,
        },
        beforeSnapshot,
        updatedModel,
        prep.generatedResourceIds,
        prep.knowledgeGaps,
      );
    } catch (err) {
      this.logger.warn('Adaptive session logging failed: ' + err);
    }
  }

  private async resolveStudentModel(userId: number, academicContext: any, memories: any[], analytics: any) {
    const persisted = await this.studentModelService.get(userId);
    if (persisted) return persisted;
    return this.studentModelService.buildModel(academicContext, memories, analytics);
  }

  private detectSubjectFromMessage(message: string, academicContext: any): string | null {
    try {
      if (academicContext?.subjects && academicContext.subjects.length) {
        const txt = (message || '').toLowerCase();
        for (const s of academicContext.subjects) {
          if (s.name && txt.includes((s.name || '').toLowerCase())) {
            return s.name;
          }
        }
      }
    } catch (err) {
      // ignore
    }
    return null;
  }

  private async autoGenerateTitle(conv: any, message: string) {
    try {
      const freshConv = await this.conversations.findOne({ _id: conv._id });
      if (freshConv && !freshConv.title) {
        const titlePrompt = [
          { role: 'system', content: 'You are a concise title generator.' },
          { role: 'user', content: `Generate a short, descriptive title (3-6 words) for this conversation: "${message}"` },
        ];
        const titleResp = await this.groq.chat(titlePrompt);
        const title = (titleResp?.content || '').trim().slice(0, 120);
        if (title) {
          await this.conversations.updateOne({ _id: conv._id }, { $set: { title, updatedAt: new Date() } });
        }
      }
    } catch (err) {
      this.logger.warn('Failed to auto-generate title: ' + err);
    }
  }

  /**
   * Genera un quiz de práctica a demanda (pestaña Quiz del Profesor IA).
   * Usa el tema indicado o infiere uno de las brechas de conocimiento y de los
   * temas recientes que el estudiante ha estado conversando con la IA.
   */
  async generateQuiz(userId: number, dto: { topic?: string; difficulty?: string; count?: number; origin?: string; material?: string }) {
    const [gaps, recentMessages] = await Promise.all([
      this.knowledgeGapsService.getTopGaps(userId, 10).catch(() => []),
      this.messages.find({ userId, role: 'user' }).sort({ createdAt: -1 }).limit(15).toArray().catch(() => []),
    ]);
    const recentTexts = (recentMessages || []).map((m) => m.content || '').filter(Boolean).reverse();
    return this.resourceGenerator.generateQuizForUser(userId, null, {
      topic: dto.topic,
      difficulty: dto.difficulty,
      count: dto.count,
      origin: dto.origin,
      material: dto.material,
      knowledgeGaps: gaps || [],
      recentUserMessages: recentTexts,
    });
  }

  /**
   * Genera flashcards de repaso a demanda (pestaña Flashcards).
   * Cada tarjeta se guarda como un recurso FLASHCARDS independiente para que el
   * estudiante pueda eliminarlas de una en una.
   */
  async generateFlashcards(userId: number, dto: { topic?: string; subject?: string; count?: number; material?: string }) {
    const [gaps, recentMessages] = await Promise.all([
      this.knowledgeGapsService.getTopGaps(userId, 10).catch(() => []),
      this.messages.find({ userId, role: 'user' }).sort({ createdAt: -1 }).limit(15).toArray().catch(() => []),
    ]);
    const recentTexts = (recentMessages || []).map((m) => m.content || '').filter(Boolean).reverse();
    return this.resourceGenerator.generateFlashcardsForUser(userId, null, {
      topic: dto.topic,
      subject: dto.subject,
      count: dto.count,
      material: dto.material,
      knowledgeGaps: gaps || [],
      recentUserMessages: recentTexts,
    });
  }

  /**
   * Lista las flashcards guardadas del estudiante ya normalizadas como tarjetas
   * (pregunta / respuesta / pista).
   */
  async listFlashcards(userId: number, limit = 100) {
    const rows = await this.generatedResourcesService.listForUser(userId);
    const take = Math.min(200, Math.max(1, Number(limit) || 100));
    return (rows || [])
      .filter((row: any) => String(row.type || row.resourceType).toUpperCase() === 'FLASHCARDS')
      .filter((row: any) => row?.content?.question && row?.content?.answer)
      .slice(0, take)
      .map((row: any) => ({
        id: String(row.id || row._id),
        question: row.content.question,
        answer: row.content.answer,
        hint: row.content.hint ?? null,
        topic: row.content.topic ?? null,
        subject: row.subject ?? row.content.subject ?? null,
        createdAt: row.createdAt ?? null,
      }));
  }

  async getDashboard(userId: number) {
    const [analytics, studentModel, goals, knowledgeGaps, allGaps, resources] = await Promise.all([
      this.learningAnalyticsService.getAnalytics(userId),
      this.studentModelService.get(userId),
      this.learningGoalsService.listGoals(userId),
      this.knowledgeGapsService.getTopGaps(userId, 10),
      this.knowledgeGapsService.listIncludingResolved(userId),
      this.generatedResourcesService.listForUser(userId),
    ]);

    const latestSnapshot = studentModel?.snapshots?.[studentModel.snapshots.length - 1];
    const masteryScore = analytics?.masteryScore ?? latestSnapshot?.masteryScore ?? 0.5;

    return {
      masteryScore,
      engagementScore: analytics?.engagementScore ?? studentModel?.engagementScore ?? 0,
      struggleScore: analytics?.struggleScore ?? 0,
      strengths: studentModel?.strengths || [],
      weaknesses: studentModel?.weaknesses || [],
      subjectLevels: studentModel?.subjectLevels || {},
      confidencePerSubject: studentModel?.confidencePerSubject || analytics?.confidencePerSubject || {},
      comprehensionSpeed: studentModel?.comprehensionSpeed || 'NORMAL',
      recurringMistakes: studentModel?.recurringMistakes || [],
      activeGoals: (goals || []).filter((goal) => goal && goal.status !== 'completed'),
      knowledgeGaps: (knowledgeGaps || []).map((gap) => ({
        id: String(gap._id || gap.id),
        topic: gap.topic,
        subject: gap.subject,
        confidence: gap.confidence,
        status: gap.status,
        evidence: gap.evidence || [],
      })),
      knowledgeGapsSummary: {
        detected: (allGaps || []).filter((gap) => gap.status === 'DETECTED').length,
        improving: (allGaps || []).filter((gap) => gap.status === 'IMPROVING').length,
        resolved: (allGaps || []).filter((gap) => gap.status === 'RESOLVED').length,
      },
      resourcesSummary: {
        total: resources.length,
        completed: resources.filter((r) => r.completed).length,
        byType: resources.reduce((acc: Record<string, number>, resource) => {
          const type = String(resource.type || resource.resourceType || 'UNKNOWN').toUpperCase();
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {}),
      },
    };
  }

  /**
   * Genera una explicación detallada de por qué la respuesta correcta es correcta.
   * Se usa cuando el estudiante hace clic en "¿Por qué?" después de responder una pregunta.
   */
  async explainAnswer(dto: {
    question: string;
    choices: string[];
    correctAnswer: string;
    topic?: string;
    isCorrect?: boolean;
  }): Promise<{ explanation: string }> {
    const prompt = `Eres un profesor universitario explicando un examen a un estudiante de forma DINÁMICA y entretenida.

Pregunta: ${dto.question}
Opciones:
${dto.choices.map((c, i) => `${String.fromCharCode(65 + i)}) ${c}`).join('\n')}
Respuesta correcta: ${dto.correctAnswer}
El estudiante ${dto.isCorrect === true ? 'ACERTÓ' : dto.isCorrect === false ? 'SE EQUIVOCÓ' : '(no se sabe si acertó)'}.
Tema: ${dto.topic}

REGLAS ESTRICTAS:
- NO escribas párrafos largos. La gente se aburre.
- Usa la estructura paso a paso con emojis numerados (1️⃣ 2️⃣ 3️⃣).
- Cada paso debe tener 1-2 oraciones MÁXIMO.
- Usa negritas para palabras clave.
- Incluye una tabla de verdad o ejemplo concreto SIEMPRE que sea posible.
- Termina con un 💡 tip corto y memorable (1 línea).
- Si el estudiante se equivocó, explica brevemente por qué su opción es incorrecta en un paso aparte.
- Sé directo, no des vueltas. Piensa en un TikTok educativo, no en un libro de texto.

Usa Markdown: negritas (**texto**), tablas |col1|col2|, y LaTeX ($fórmula$) para matemáticas.
Responde SOLO con el texto de la explicación, sin JSON.`;

    const { content } = await this.groq.chat([{ role: 'user', content: prompt }]);
    return { explanation: content };
  }
}
