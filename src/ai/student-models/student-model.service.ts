// @ts-nocheck
import { Injectable, Logger } from '@nestjs/common';
import { StudentModelRepository } from './student-model.repository';

@Injectable()
export class StudentModelService {
  private readonly logger = new Logger(StudentModelService.name);

  constructor(private readonly repo: StudentModelRepository) {}

  /**
   * Compute a student model from multiple signals and persist it.
   * analytics: array of { subject, questionsAsked, correctAnswers }
   * memories: teacher memories
   * knowledgeGaps: array of gaps
   * messages: recent user messages
   */
  async updateFromSignals(userId: number, academicContext: any, analytics: any, memories: any[], knowledgeGaps: any[], messages: string[], recurringMistakes: any[] = [], generatedResources: any[] = [], conversationHistory: any[] = []) {
    // Build model
    const preferredSubjects = (memories || []).filter((m) => m.type === 'SUBJECT_PREFERENCE').map((m) => m.value);
    const difficultSubjects = (memories || []).filter((m) => m.type === 'SUBJECT_DIFFICULTY' || m.type === 'WEAK_SKILL').map((m) => m.value);

    const confidencePerSubject: Record<string, number> = {};
    // analytics may be an aggregated object from LearningAnalyticsService or raw rows
    const analyticsRows: any[] = Array.isArray(analytics) ? analytics : (analytics && (analytics as any).raw) ? (analytics as any).raw : [];
    for (const a of analyticsRows || []) {
      const subj = String((a as any).subject || 'general');
      const q = (a as any).questionsAsked || 0;
      const c = (a as any).correctAnswers || 0;
      confidencePerSubject[subj] = q > 0 ? Math.max(0, Math.min(1, c / q)) : (confidencePerSubject[subj] || 0.5);
    }

    // derive engagementScore from message frequency and recency
    const engagementScore = Math.min(1, Math.max(0, (messages || []).length / 20));

    // comprehensionSpeed heuristic will be computed later after considering conversation history

    // derive subjectLevels per subject based on confidence and mastery
    const subjectLevels: Record<string, 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'> = {};
    const mastery = analytics?.masteryScore ?? null;
    const confMap = confidencePerSubject || {};
    const subjects = academicContext?.subjects?.map((s) => s.name) || Object.keys(confMap);
    for (const subj of Array.from(new Set(subjects || [])) as string[]) {
      const conf = confMap[subj] ?? 0.5;
      // map confidence/mass to levels
      if (conf >= 0.8 && (mastery === null || mastery >= 0.75)) subjectLevels[subj] = 'ADVANCED';
      else if (conf >= 0.55 || (mastery !== null && mastery >= 0.6)) subjectLevels[subj] = 'INTERMEDIATE';
      else subjectLevels[subj] = 'BEGINNER';
    }

    // strengths: subjects with sustained high mastery/confidence across sessions
    const prev = await this.repo.findByUser(userId);
    const prevStrengths: string[] = (prev && prev.strengths) || [];
    const strengths: string[] = Array.from(new Set(prevStrengths.concat(Object.keys(subjectLevels).filter((s) => subjectLevels[s] === 'ADVANCED' && (confMap[s] || 0) >= 0.7))));

    // weaknesses: if struggleScore high or persistent detected gaps or recurring mistakes
    const weaknessesSet = new Set<string>((prev && prev.weaknesses) || []);
    const struggleScore = analytics?.struggleScore ?? 0;
    if (struggleScore > 0.65) {
      // add subjects with low confidence
      for (const [s, v] of Object.entries(confMap)) if (v < 0.6) weaknessesSet.add(s);
    }
    // knowledgeGaps may include topics with subject; add subject-level weaknesses for recurrent gaps
    for (const g of knowledgeGaps || []) {
      if (g.status === 'DETECTED' && g.subject) weaknessesSet.add(g.subject);
    }
    // recurring mistakes map to weaknesses
    const recurringMistakeLabels: string[] = [];
    for (const rm of recurringMistakes || []) {
      if (rm.subject) weaknessesSet.add(rm.subject);
      else if (rm.topic) weaknessesSet.add(rm.topic);
      if (rm.value || rm.topic || rm.key) recurringMistakeLabels.push(String(rm.value || rm.topic || rm.key));
    }

    // Allow recovery: remove weaknesses if confidence improved over previous snapshot
    // we compare prev.confidencePerSubject if available
    if (prev && prev.confidencePerSubject) {
      for (const [s, v] of Object.entries(prev.confidencePerSubject) as [string, number][]) {
        const cur = (confMap as Record<string, number>)[s] ?? v;
        if ((weaknessesSet.has(s) || (prev.weaknesses || []).includes(s)) && cur - (v as number) > 0.15) {
          weaknessesSet.delete(s);
        }
      }
    }

    const weaknesses = Array.from(weaknessesSet);

    // comprehension speed dynamic update using recent message lengths and frequency
    const recentMsgCount = (conversationHistory || []).filter((m) => m.role === 'user').length || (messages || []).length;
    let comprehensionSpeedLevel: 'FAST' | 'NORMAL' | 'SLOW' = 'NORMAL';
    const avgLen = (messages || []).reduce((s, m) => s + (m?.length || 0), 0) / Math.max(1, (messages || []).length);
    if (avgLen > 250 && recentMsgCount > 3) comprehensionSpeedLevel = 'FAST';
    else if (avgLen < 80 && recentMsgCount > 3) comprehensionSpeedLevel = 'SLOW';

    // evolve strengths/weaknesses over time: keep snapshots array in document
    const snapshot = {
      timestamp: new Date(),
      strengths,
      weaknesses,
      subjectLevels,
      masteryScore: analytics?.masteryScore ?? null,
      confidencePerSubject: confMap,
    };

    // Merge into model
    const model = {
      learningStyle: (memories || []).find((m) => m.type === 'LEARNING_STYLE')?.value || (prev && prev.learningStyle) || 'mixed',
      academicLevel: academicContext?.level || academicContext?.semester || (prev && prev.academicLevel) || 'unknown',
      comprehensionSpeed: comprehensionSpeedLevel,
      preferredSubjects: Array.from(new Set(preferredSubjects)),
      difficultSubjects: Array.from(new Set(difficultSubjects)),
      confidencePerSubject: confMap,
      engagementScore: analytics?.engagementScore ?? ((prev && prev.engagementScore) ?? 0),
      strengths,
      weaknesses,
      recurringMistakes: Array.from(new Set([...(prev?.recurringMistakes || []), ...recurringMistakeLabels])).slice(-20),
      subjectLevels,
      snapshots: [...((prev && prev.snapshots) || []).slice(-50), snapshot], // keep last 50 snapshots
      lastUpdatedAt: new Date(),
    };

    const saved = await this.repo.upsert(userId, model);
    this.logger.log(`Evolved student model for ${userId}: strengths=${strengths.length} weaknesses=${weaknesses.length}`);
    return saved;
  }

  /**
   * Build a lightweight model used by the adaptive engine from available signals.
   * If analytics is the output from LearningAnalyticsService.getAnalytics it may already contain aggregates.
   */
  buildModel(academicContext: any, memories: any[], analyticsOrAggregates: any) {
    // analyticsOrAggregates may be an array (raw) or an object with computed aggregates
    let confidencePerSubject: Record<string, number> = {};
    let masteryScore = 0.5;
    let engagementScore = 0.5;

    if (Array.isArray(analyticsOrAggregates)) {
      for (const a of analyticsOrAggregates || []) {
        const subj = a.subject || 'general';
        const q = a.questionsAsked || 0;
        const c = a.correctAnswers || 0;
        confidencePerSubject[subj] = q > 0 ? Math.max(0, Math.min(1, c / q)) : 0.5;
      }
      const vals = Object.values(confidencePerSubject);
      masteryScore = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0.5;
    } else if (analyticsOrAggregates && analyticsOrAggregates.confidencePerSubject) {
      confidencePerSubject = analyticsOrAggregates.confidencePerSubject;
      masteryScore = analyticsOrAggregates.masteryScore || 0.5;
      engagementScore = analyticsOrAggregates.engagementScore || 0.5;
    }

    const subjectLevels: Record<string, 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'> = {};
    const subjects = academicContext?.subjects?.map((s) => s.name) || Object.keys(confidencePerSubject);
    for (const subj of Array.from(new Set(subjects || [])) as string[]) {
      const conf = confidencePerSubject[subj] ?? 0.5;
      if (conf >= 0.8 && masteryScore >= 0.75) subjectLevels[subj] = 'ADVANCED';
      else if (conf >= 0.55 || masteryScore >= 0.6) subjectLevels[subj] = 'INTERMEDIATE';
      else subjectLevels[subj] = 'BEGINNER';
    }

    const strengths = (memories || []).filter((m) => m.type === 'SUBJECT_PREFERENCE').map((m) => m.value);
    const weaknesses = (memories || [])
      .filter((m) => ['SUBJECT_DIFFICULTY', 'WEAK_SKILL', 'RECURRING_MISTAKE'].includes(m.type))
      .map((m) => m.value || m.key);
    const recurringMistakes = (memories || []).filter((m) => m.type === 'RECURRING_MISTAKE').map((m) => m.value || m.key);

    const model = {
      learningStyle: (memories || []).find((m) => m.type === 'LEARNING_STYLE')?.value || 'mixed',
      academicLevel: academicContext?.level || academicContext?.semester || 'unknown',
      confidencePerSubject,
      masteryScore,
      engagementScore,
      subjectLevels,
      strengths,
      weaknesses,
      recurringMistakes,
      comprehensionSpeed: 'NORMAL' as const,
    };

    return model;
  }

  async get(userId: number) {
    return this.repo.findByUser(userId);
  }
}
