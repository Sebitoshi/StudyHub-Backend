import { Inject, Injectable, Logger } from '@nestjs/common';
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
import { LearningPathsService } from './learning-paths/learning-paths.service';
import { AdaptiveSessionsService } from './adaptive/adaptive-sessions.service';
import { ExamCoachService } from './adaptive/exam-coach.service';

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
    private readonly learningPathsService: LearningPathsService,
    private readonly adaptiveSessionsService: AdaptiveSessionsService,
    private readonly examCoachService: ExamCoachService,
  ) {}

  async ensureConversation(userId: number, conversationId?: string | number) {
    if (conversationId) {
      try {
        const oid = typeof conversationId === 'string' ? new ObjectId(conversationId) : new ObjectId(String(conversationId));
        const conv = await this.conversations.findOne({ _id: oid });
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

  async chat(userId: number, conversationId: string | number | undefined, message: string, teacherId?: string) {
    const conv = await this.ensureConversation(userId, conversationId);
    if (!conv) throw new Error('Failed to create or fetch conversation');

    const userMsg = {
      conversationId: conv._id,
      userId,
      role: 'user',
      content: message,
      tokensUsed: null,
      model: null,
      attachments: [],
      createdAt: new Date(),
    };

    await this.messages.insertOne(userMsg);
    await this.conversations.updateOne({ _id: conv._id }, { $inc: { messageCount: 1 }, $set: { lastMessageAt: new Date() } });

    // Build academic context early (used for profile detection and analytics)
    const academicContext = await this.academicService.buildAcademicContext(userId);

    // Detect teacher profile
    const teacherProfile = await this.teacherProfileService.detectProfile(message, academicContext);

    // Detect intent / prompt template
    const promptTemplate = this.promptTemplateService.detectIntent(message);

    // Register question in learning analytics (try detect subject)
    let detectedSubject: string | null = null;
    try {
      if (academicContext?.subjects && academicContext.subjects.length) {
        const txt = (message || '').toLowerCase();
        for (const s of academicContext.subjects) {
          if (s.name && txt.includes((s.name || '').toLowerCase())) {
            detectedSubject = s.name;
            break;
          }
        }
      }
    } catch (err) {
      // ignore
    }
    await this.learningAnalyticsService.recordQuestion(userId, detectedSubject);

    // Build simple messages for Groq
    const historyCursor = this.messages.find({ conversationId: conv._id }).sort({ createdAt: 1 }).limit(50);
    const history = await historyCursor.toArray();
    const conversationContext = history.map((m) => ({ role: m.role, content: m.content }));

    // Retrieve relevant memories
    const memories: any = await this.memoryService.getRelevantMemories(userId, message, 10);

    // Detect and upsert knowledge gaps (heuristic) then fetch top gaps
    try {
      await this.knowledgeGapsService.detectAndUpsertGaps(userId, academicContext);
    } catch (err) {
      this.logger.warn('Knowledge gap detection failed: ' + err);
    }
    const knowledgeGaps = await this.knowledgeGapsService.getTopGaps(userId, 5);

    // Adaptive learning analysis: decide teaching mode, suggested actions and resources
    const adaptive = this.adaptiveLearningService.analyze(message, academicContext, memories, [], knowledgeGaps);

    // load current student model to adapt prompt
    const currentStudentModel = await this.studentModelService.get(userId);

    // If exam/coach mode detected, generate practice exam and quick plan and persist them
    try {
      const isExam = adaptive?.mode === 'COACH' || (promptTemplate && promptTemplate.code === 'EXAM_PREPARATION') || /examen|parcial|final|evaluaci[oó]n|simulacro/.test(message.toLowerCase());
      if (isExam) {
        const exam = this.examCoachService.generateMockExam(message, 6);
        const examResId = await this.generatedResourcesService.saveResource(userId, conv._id, 'practice_exam', `Simulacro: ${message}`, { exam });
        const planId = await this.learningPathsService.createPath(userId, academicContext?.subjects?.[0]?.name || 'general', `Preparación para ${message}`, [{ day: 1, tasks: ['Repasar conceptos clave', 'Resolver 5 ejercicios'] }]);
        adaptive.actions = adaptive.actions || {};
        adaptive.actions.generatedExamId = examResId;
        adaptive.actions.generatedPlanId = planId;
      }
    } catch (err) {
      this.logger.warn('Exam generation failed: ' + err);
    }

    const memForPrompt = (memories || []).map((m: any) => ({ type: String(m.type || ''), key: String(m.key || m.type || ''), value: String(m.value || '') }));
    const gapsForPrompt = (knowledgeGaps || []).map((g: any) => ({ topic: String(g.topic || g.name || ''), subject: g.subject, confidence: g.confidence, status: g.status }));
    const messagesForModel = await this.promptBuilder.buildPrompt(userId, conversationContext, message, memForPrompt, teacherProfile, promptTemplate, gapsForPrompt, currentStudentModel, adaptive);

    const response = await this.groq.chat(messagesForModel);

    const assistantMsg = {
      conversationId: conv._id,
      userId,
      role: 'assistant',
      content: response.content,
      tokensUsed: response.tokensUsed || 0,
      model: response.model || process.env.GROQ_MODEL || null,
      attachments: [],
      createdAt: new Date(),
    };

    await this.messages.insertOne(assistantMsg);
    await this.conversations.updateOne({ _id: conv._id }, { $inc: { messageCount: 1 }, $set: { lastMessageAt: new Date() } });

    // Auto-generate title from first user message if title is empty
    try {
      if (!conv.title) {
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

    return { conversationId: conv._id, reply: response.content };
  }

  async streamChat(
    userId: number,
    conversationId: string | number | undefined,
    message: string,
    teacherId: string | undefined,
    onChunk: (chunk: string) => Promise<void> | void,
  ) {
    const conv = await this.ensureConversation(userId, conversationId);
    if (!conv) throw new Error('Failed to create or fetch conversation');

    const userMsg = {
      conversationId: conv._id,
      userId,
      role: 'user',
      content: message,
      tokensUsed: null,
      model: null,
      attachments: [],
      createdAt: new Date(),
    };

    await this.messages.insertOne(userMsg);
    await this.conversations.updateOne({ _id: conv._id }, { $inc: { messageCount: 1 }, $set: { lastMessageAt: new Date() } });

    // Build history
    const historyCursor = this.messages.find({ conversationId: conv._id }).sort({ createdAt: 1 }).limit(50);
    const history = await historyCursor.toArray();
    const conversationContext = history.map((m) => ({ role: m.role, content: m.content }));

    // Build academic context, detect profile and intent for streaming flow
    const academicContext = await this.academicService.buildAcademicContext(userId);
    const teacherProfile = await this.teacherProfileService.detectProfile(message, academicContext);
    const promptTemplate = this.promptTemplateService.detectIntent(message);

    // Register analytics
    let detectedSubject: string | null = null;
    try {
      if (academicContext?.subjects && academicContext.subjects.length) {
        const txt = (message || '').toLowerCase();
        for (const s of academicContext.subjects) {
          if (s.name && txt.includes((s.name || '').toLowerCase())) {
            detectedSubject = s.name;
            break;
          }
        }
      }
    } catch (err) {}
    await this.learningAnalyticsService.recordQuestion(userId, detectedSubject);

    // Retrieve relevant memories
    const memories: any = await this.memoryService.getRelevantMemories(userId, message, 10);

    // Detect and upsert knowledge gaps, then fetch top gaps
    try {
      await this.knowledgeGapsService.detectAndUpsertGaps(userId, academicContext);
    } catch (err) {
      this.logger.warn('Knowledge gap detection failed: ' + err);
    }
    const knowledgeGaps = await this.knowledgeGapsService.getTopGaps(userId, 5);

    // Adaptive learning analysis: decide teaching mode, suggested actions and resources
    const adaptive = this.adaptiveLearningService.analyze(message, academicContext, memories, [], knowledgeGaps);

    const currentStudentModel = await this.studentModelService.get(userId);
    const memForPrompt2 = (memories || []).map((m: any) => ({ type: String(m.type || ''), key: String(m.key || m.type || ''), value: String(m.value || '') }));
    const gapsForPrompt2 = (knowledgeGaps || []).map((g: any) => ({ topic: String(g.topic || g.name || ''), subject: g.subject, confidence: g.confidence, status: g.status }));
    const messagesForModel = await this.promptBuilder.buildPrompt(userId, conversationContext, message, memForPrompt2, teacherProfile, promptTemplate, gapsForPrompt2, currentStudentModel, adaptive);

    // Try streaming via GroqService
    let finalContent = '';
    const messagesForModelWithMemories = messagesForModel;

    const usedStream = await this.groq.stream(messagesForModelWithMemories, async (chunk: string) => {
      finalContent += chunk;
      await onChunk(chunk);
    });

    if (!usedStream) {
      // fallback to single response
      const response = await this.groq.chat(messagesForModelWithMemories);
      finalContent = response.content;
      await onChunk(finalContent);
    }

    const assistantMsg = {
      conversationId: conv._id,
      userId,
      role: 'assistant',
      content: finalContent,
      tokensUsed: null,
      model: process.env.GROQ_MODEL || null,
      attachments: [],
      createdAt: new Date(),
    };

    await this.messages.insertOne(assistantMsg);
    await this.conversations.updateOne({ _id: conv._id }, { $inc: { messageCount: 1 }, $set: { lastMessageAt: new Date() } });

    // Auto-generate title if not set
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

    // Analyze conversation and store/update memories using rule-based extractor
    let historyAll: any[] = [];
    try {
      const historyAllCursor = this.messages.find({ conversationId: conv._id }).sort({ createdAt: 1 }).limit(100);
      historyAll = await historyAllCursor.toArray();
      const convoMessages = historyAll.map((m) => ({ role: m.role, content: m.content }));
      await this.memoryService.analyzeAndStore(userId, convoMessages, academicContext);
    } catch (err) {
      this.logger.warn('Memory analysis failed: ' + err);
    }

    // Update student model from signals; capture before/after snapshots for adaptive session logging
    let updatedModel: any = null;
    let beforeSnapshot: any = null;
    try {
      const analytics = await this.learningAnalyticsService.getAnalytics(userId);
      const memoriesAll = await this.memoryService.getUserMemories(userId);
      const knowledgeGaps = await this.knowledgeGapsService.getTopGaps(userId, 50);
      const recentTexts = historyAll.filter((m) => m.role === 'user').map((m) => m.content || '');
      const recurringMistakes = (memoriesAll || []).filter((m) => ['RECURRING_MISTAKE', 'WEAK_SKILL'].includes(m.type));
      let generatedResources: any[] = [];
      try {
        generatedResources = await this.generatedResourcesService.listForUser(userId);
      } catch (err) {
        // ignore generated resources retrieval
      }

      beforeSnapshot = await this.studentModelService.get(userId);
      updatedModel = await this.studentModelService.updateFromSignals(userId, academicContext, analytics, memoriesAll, knowledgeGaps, recentTexts, recurringMistakes, generatedResources, historyAll);

      // Log adaptive session with before/after and resources
      try {
        const genIds = []; // in future, collect ids from resource generation
        await this.adaptiveSessionsService.logSession(userId, conv._id, { teacherProfile: teacherProfile?.code || null, promptTemplate: promptTemplate?.code || null, adaptive: adaptive || null }, beforeSnapshot, updatedModel, genIds, knowledgeGaps);
      } catch (err) {
        this.logger.warn('Adaptive session logging failed: ' + err);
      }
    } catch (err) {
      this.logger.warn('Student model update failed: ' + err);
    }

    // Log adaptive session
    try {
      const sessionPayload = { teacherProfile: teacherProfile?.code || null, promptTemplate: promptTemplate?.code || null, adaptive: adaptive || null };
      await this.adaptiveSessionsService.logSession(userId, conv._id, sessionPayload);
    } catch (err) {
      this.logger.warn('Adaptive session logging failed: ' + err);
    }

    return { conversationId: conv._id, reply: finalContent };
  }
}
