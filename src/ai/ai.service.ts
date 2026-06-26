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
import { AdaptiveSessionsService } from './adaptive/adaptive-sessions.service';
import { LearningGoalsService } from './learning-goals/learning-goals.service';

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

  private async persistUserMessage(conversationId: any, userId: number, message: string) {
    const userMsg = {
      conversationId,
      userId,
      role: 'user',
      content: message,
      tokensUsed: null,
      model: null,
      attachments: [],
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
    const conversationContext = history.map((m) => ({ role: m.role, content: m.content }));

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

  private async buildModelPrompt(userId: number, prep: any, message: string) {
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
    );
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
}
