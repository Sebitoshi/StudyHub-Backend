import { Injectable } from '@nestjs/common';

export type GapStatus = 'DETECTED' | 'IMPROVING' | 'RESOLVED';

export interface GapRecoveryInput {
  gap: any;
  analytics?: any;
  resources?: any[];
  stillDetected?: boolean;
  currentConfidence?: number;
}

export interface GapRecoveryResult {
  status: GapStatus;
  confidence: number;
  evidence: string[];
}

@Injectable()
export class GapRecoveryService {
  evaluate(input: GapRecoveryInput): GapRecoveryResult {
    const { gap, analytics, resources, stillDetected = true, currentConfidence } = input;
    const evidence = new Set<string>([...(gap.evidence || [])]);
    const subject = gap.subject || 'general';
    const gapId = gap._id ? String(gap._id) : gap.id ? String(gap.id) : null;

    const linkedResources = this.filterLinkedResources(resources || [], gap, gapId);
    const completedQuizzes = linkedResources.filter(
      (resource) => this.isType(resource, 'QUIZ') && resource.completed && this.isPassingAttempt(resource),
    );
    const completedExams = linkedResources.filter(
      (resource) => this.isType(resource, 'EXAM_SIMULATION') && resource.completed && this.isPassingAttempt(resource),
    );
    const completedAny = linkedResources.filter((resource) => resource.completed);
    const subjectConfidence = analytics?.confidencePerSubject?.[subject] ?? this.subjectCorrectRatio(analytics, subject);

    if (completedQuizzes.length > 0) evidence.add(`${completedQuizzes.length} quizzes correctos`);
    if (completedExams.length > 0) evidence.add(`${completedExams.length} simulacros correctos`);
    if (completedAny.length > 0) evidence.add(`${completedAny.length} recursos completados`);

    if (completedQuizzes.length >= 3 &&
      completedExams.length >= 2 &&
      subjectConfidence >= 0.8) {
      return {
        status: 'RESOLVED',
        confidence: Number(Math.max(0.08, 1 - subjectConfidence).toFixed(2)),
        evidence: [...evidence, 'recovery:criterios_cumplidos'],
      };
    }

    const improving =
      completedQuizzes.length >= 1 ||
      completedExams.length >= 1 ||
      completedAny.length >= 2 ||
      subjectConfidence >= 0.65;

    if (improving && (gap.status === 'IMPROVING' || gap.status === 'DETECTED')) {
      return {
        status: 'IMPROVING',
        confidence: currentConfidence ?? gap.confidence ?? 0.5,
        evidence: [...evidence, 'recovery:progreso_detectado'],
      };
    }

    if (gap.status === 'RESOLVED' && stillDetected && (currentConfidence ?? 0) >= 0.6) {
      return {
        status: 'DETECTED',
        confidence: currentConfidence ?? gap.confidence ?? 0.6,
        evidence: [...evidence, 'recovery:regresion_detectada'],
      };
    }

    if (gap.status === 'RESOLVED' && !stillDetected) {
      return {
        status: 'RESOLVED',
        confidence: gap.confidence ?? 0.1,
        evidence: Array.from(evidence),
      };
    }

    return {
      status: stillDetected ? 'DETECTED' : gap.status || 'DETECTED',
      confidence: currentConfidence ?? gap.confidence ?? 0.5,
      evidence: Array.from(evidence),
    };
  }

  private filterLinkedResources(resources: any[], gap: any, gapId: string | null) {
    const topic = String(gap.topic || '').toLowerCase();
    const subject = gap.subject || 'general';

    return resources.filter((resource) => {
      if (gapId && resource.sourceKnowledgeGap === gapId) return true;
      if (subject !== 'general' && resource.subject === subject && this.matchesTopic(resource, topic)) return true;
      return this.matchesTopic(resource, topic);
    });
  }

  private matchesTopic(resource: any, topic: string) {
    if (!topic) return false;
    const haystack = `${resource.title || ''} ${JSON.stringify(resource.content || {})}`.toLowerCase();
    return haystack.includes(topic) || topic.split(/\s+/).some((word) => word.length > 3 && haystack.includes(word));
  }

  private isType(resource: any, type: string) {
    return String(resource.type || resource.resourceType || '').toUpperCase() === type;
  }

  private isPassingAttempt(resource: any) {
    if (!resource.completed) return false;
    if (typeof resource.resultScore === 'number') return resource.resultScore >= 0.7;
    if (typeof resource.resultCorrect === 'number' && typeof resource.resultTotal === 'number' && resource.resultTotal > 0) {
      return resource.resultCorrect / resource.resultTotal >= 0.7;
    }
    return true;
  }

  private subjectCorrectRatio(analytics: any, subject: string) {
    const row = (analytics?.raw || []).find((item: any) => item.subject === subject);
    if (!row?.questionsAsked) return 0.5;
    return row.correctAnswers / row.questionsAsked;
  }
}
