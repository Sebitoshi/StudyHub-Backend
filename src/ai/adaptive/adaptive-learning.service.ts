import { Injectable } from '@nestjs/common';
import { SocraticService } from './socratic.service';
import { ResourceGeneratorService } from './resource-generator.service';
import { LearningPathService } from './learning-path.service';
import { WeaknessPredictionService } from './weakness-prediction.service';
import { ExamCoachService } from './exam-coach.service';
import { RecommendationService } from './recommendation.service';
import { StudentModelService } from '../student-models/student-model.service';

@Injectable()
export class AdaptiveLearningService {
  constructor(
    private readonly socratic: SocraticService,
    private readonly resources: ResourceGeneratorService,
    private readonly paths: LearningPathService,
    private readonly weakness: WeaknessPredictionService,
    private readonly exam: ExamCoachService,
    private readonly rec: RecommendationService,
    private readonly studentModel: StudentModelService,
  ) {}

  analyze(userMessage: string, academicContext: any, memories: any[], analytics: any, knowledgeGaps: any[], persistentStudentModel?: any) {
    const model = persistentStudentModel || this.studentModel.buildModel(academicContext, memories, analytics);
    const mode = this.socratic.decideMode(userMessage, model);
    const predictedWeaknesses = this.weakness.predictFromGaps(knowledgeGaps || []);
    const triggers = this.detectTriggers(userMessage, model, analytics, knowledgeGaps, memories, predictedWeaknesses);

    const actions: any = {};
    if (mode === 'COACH' || triggers.some((trigger) => trigger.type === 'EXAM_MODE')) {
      actions.examMode = true;
    }
    if (mode && mode.startsWith('SOCRATIC')) {
      actions.socraticPrompts = this.socratic.generateSocraticPrompts(userMessage, mode);
    }
    // Always suggest recommendations for top predicted weakness
    if (predictedWeaknesses && predictedWeaknesses.length) {
      actions.recommendations = this.rec.recommendResources(predictedWeaknesses[0].topic);
    }

    actions.learningPath = this.paths.createQuickPath(userMessage, 7);

    return { mode, model, predictedWeaknesses, triggers, actions };
  }

  async generateAutomaticResources(
    userId: number,
    conversationId: any,
    adaptive: any,
    userMessage: string,
    academicContext: any,
    studentModel?: any,
    knowledgeGaps?: any[],
    extras?: { learningGoals?: any[]; teacherProfile?: any },
  ) {
    const triggers = adaptive?.triggers || [];
    if (!triggers.length) return { generated: [], ids: {} };

    const topTrigger = this.rankTriggers(triggers)[0];
    const subject = this.detectSubject(userMessage, academicContext, studentModel, knowledgeGaps || [], topTrigger);
    const topic = topTrigger.topic || subject || userMessage;
    const generated = await this.resources.generateAndPersistResources(
      userId,
      conversationId,
      {
        topic,
        subject,
        trigger: topTrigger.type,
        sourceKnowledgeGap: topTrigger.sourceKnowledgeGap || null,
        userMessage,
        academicContext,
        studentModel,
        knowledgeGaps,
        learningGoals: extras?.learningGoals || [],
        teachingStrategy: adaptive,
        teacherProfile: extras?.teacherProfile || null,
      },
    );

    adaptive.actions = adaptive.actions || {};
    adaptive.actions.generatedResources = generated.resources || [];
    return generated;
  }

  private detectTriggers(userMessage: string, model: any, analytics: any, knowledgeGaps: any[], memories: any[], predictedWeaknesses: any[]) {
    const text = (userMessage || '').toLowerCase();
    const triggers: any[] = [];

    if (/tengo examen mañana|parcial mañana|final la pr[oó]xima semana|evaluaci[oó]n pronto|examen|parcial|final|quiz|simulacro/.test(text)) {
      triggers.push({ type: 'EXAM_MODE', reason: 'exam_phrase', topic: userMessage });
    }

    if (/haz(me)?|genera|crea|necesito|quiero|dame/.test(text) && /resumen|flashcards?|quiz|plan|simulacro|preguntas|recursos?/.test(text)) {
      triggers.push({ type: 'EXPLICIT_REQUEST', reason: 'student_requested_resource', topic: userMessage });
    }

    for (const gap of knowledgeGaps || []) {
      if (gap?.status === 'DETECTED' || gap?.status === 'IMPROVING' || gap?.confidence >= 0.65) {
        triggers.push({
          type: 'KNOWLEDGE_GAP',
          reason: 'active_gap',
          topic: gap.topic || gap.subject,
          subject: gap.subject,
          sourceKnowledgeGap: gap._id ? String(gap._id) : gap.id,
        });
        break;
      }
    }

    const recurring = (memories || []).find((memory) => ['RECURRING_MISTAKE', 'WEAK_SKILL'].includes(memory.type));
    if (recurring || (predictedWeaknesses || []).length) {
      const weakness = recurring?.value || predictedWeaknesses?.[0]?.topic;
      triggers.push({ type: 'RECURRENT_WEAKNESS', reason: 'recurring_mistake_or_predicted_weakness', topic: weakness });
    }

    const masteryScore = analytics?.masteryScore ?? model?.masteryScore;
    if (typeof masteryScore === 'number' && masteryScore < 0.55) {
      triggers.push({ type: 'LOW_MASTERY', reason: 'low_mastery_score', topic: this.lowestSubject(model, analytics) });
    }

    return this.dedupeTriggers(triggers);
  }

  private rankTriggers(triggers: any[]) {
    const priority: Record<string, number> = {
      EXAM_MODE: 5,
      EXPLICIT_REQUEST: 4,
      KNOWLEDGE_GAP: 3,
      RECURRENT_WEAKNESS: 2,
      LOW_MASTERY: 1,
    };
    return [...triggers].sort((a, b) => (priority[b.type] || 0) - (priority[a.type] || 0));
  }

  private dedupeTriggers(triggers: any[]) {
    const seen = new Set<string>();
    return triggers.filter((trigger) => {
      const key = `${trigger.type}:${trigger.topic || trigger.subject || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private lowestSubject(model: any, analytics: any) {
    const confidence = analytics?.confidencePerSubject || model?.confidencePerSubject || {};
    const sorted = Object.entries(confidence).sort((a: any, b: any) => a[1] - b[1]);
    return sorted[0]?.[0] || model?.weaknesses?.[0] || 'general';
  }

  private detectSubject(userMessage: string, academicContext: any, studentModel: any, knowledgeGaps: any[], trigger: any) {
    if (trigger?.subject) return trigger.subject;
    const text = (userMessage || '').toLowerCase();
    const fromContext = (academicContext?.subjects || []).find((subject) => subject.name && text.includes(subject.name.toLowerCase()));
    if (fromContext?.name) return fromContext.name;
    const fromGap = (knowledgeGaps || []).find((gap) => gap.subject);
    if (fromGap?.subject) return fromGap.subject;
    return Object.keys(studentModel?.subjectLevels || {})[0] || 'general';
  }
}
