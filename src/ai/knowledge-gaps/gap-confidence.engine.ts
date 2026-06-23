import { Injectable } from '@nestjs/common';
import { DetectedGapCandidate } from './knowledge-vector.types';

export interface GapConfidenceInput {
  candidate: DetectedGapCandidate;
  analytics?: any;
  resources?: any[];
  existingGap?: any;
}

export interface GapConfidenceResult {
  confidence: number;
  evidence: string[];
}

@Injectable()
export class GapConfidenceEngine {
  compute(input: GapConfidenceInput): GapConfidenceResult {
    const { candidate, analytics, resources, existingGap } = input;
    const subject = candidate.subject || 'general';
    const topic = (candidate.topic || '').toLowerCase();

    const evidence = new Set<string>([...(candidate.evidence || []), ...(existingGap?.evidence || [])]);
    const signals: number[] = [candidate.confidence * 0.35];

    const similarQuestions = this.extractSimilarQuestionCount(evidence);
    if (similarQuestions > 0) {
      evidence.add(`${similarQuestions} preguntas similares`);
      signals.push(Math.min(similarQuestions / 6, 1) * 0.2);
    }

    const subjectAnalytics = this.getSubjectAnalytics(analytics, subject);
    if (subjectAnalytics.questionsAsked > 0) {
      const struggle = subjectAnalytics.questionsAsked >= 3 && subjectAnalytics.correctRatio < 0.7
        ? (1 - subjectAnalytics.correctRatio) * Math.min(1, subjectAnalytics.questionsAsked / 10)
        : 0;
      if (struggle > 0.2) {
        evidence.add(`${subjectAnalytics.questionsAsked - subjectAnalytics.correctAnswers} errores recurrentes`);
        signals.push(struggle * 0.2);
      }
      if (subjectAnalytics.questionsAsked >= 5 && subjectAnalytics.correctRatio < 0.5) {
        evidence.add('analytics:baja_precision_materia');
        signals.push(0.12);
      }
    }

    if (typeof analytics?.struggleScore === 'number' && analytics.struggleScore > 0.45) {
      signals.push(analytics.struggleScore * 0.1);
      evidence.add('analytics:struggle_elevado');
    }

    const quizStats = this.getQuizStats(resources || [], candidate, existingGap);
    if (quizStats.failed > 0) {
      evidence.add(`${quizStats.failed} quizzes fallados`);
      signals.push(Math.min(quizStats.failed / 4, 1) * 0.15);
    }
    if (quizStats.attempted > 0 && quizStats.passRate < 0.5) {
      evidence.add('quizzes:baja_precision');
      signals.push((1 - quizStats.passRate) * 0.1);
    }

    const completedLinked = this.countCompletedLinkedResources(resources || [], candidate, existingGap);
    if (completedLinked > 0) {
      evidence.add(`${completedLinked} recursos completados vinculados`);
    }

    const semanticHits = [...evidence].filter((item) => item.startsWith('semantic:')).length;
    if (semanticHits >= 2) {
      evidence.add('deteccion_semantica_reforzada');
      signals.push(Math.min(semanticHits / 5, 1) * 0.08);
    }

    const confidence = this.clamp(signals.reduce((sum, value) => sum + value, 0), 0.12, 0.98);

    return {
      confidence: Number(confidence.toFixed(2)),
      evidence: Array.from(evidence),
    };
  }

  private extractSimilarQuestionCount(evidence: Set<string>) {
    let max = 0;
    for (const item of evidence) {
      const match = item.match(/^semantic:similar_questions:(\d+)$/) || item.match(/^(\d+) preguntas similares$/);
      if (match) max = Math.max(max, Number(match[1]));
    }
    return max;
  }

  private getSubjectAnalytics(analytics: any, subject: string) {
    const row = (analytics?.raw || []).find((item: any) => item.subject === subject);
    const questionsAsked = row?.questionsAsked || 0;
    const correctAnswers = row?.correctAnswers || 0;
    const correctRatio = questionsAsked > 0 ? correctAnswers / questionsAsked : analytics?.confidencePerSubject?.[subject] ?? 0.5;
    return { questionsAsked, correctAnswers, correctRatio };
  }

  private getQuizStats(resources: any[], candidate: DetectedGapCandidate, existingGap?: any) {
    const linked = this.filterLinkedResources(resources, candidate, existingGap, ['QUIZ']);
    const attempted = linked.filter((resource) => resource.completed).length;
    const passed = linked.filter((resource) => this.isPassingAttempt(resource)).length;
    const failed = attempted - passed;
    return {
      attempted,
      failed: Math.max(failed, 0),
      passRate: attempted > 0 ? passed / attempted : 1,
    };
  }

  private countCompletedLinkedResources(resources: any[], candidate: DetectedGapCandidate, existingGap?: any) {
    return this.filterLinkedResources(resources, candidate, existingGap).filter((resource) => resource.completed).length;
  }

  private filterLinkedResources(resources: any[], candidate: DetectedGapCandidate, existingGap?: any, types?: string[]) {
    const gapId = existingGap?._id ? String(existingGap._id) : null;
    const topic = (candidate.topic || '').toLowerCase();
    const subject = candidate.subject || 'general';

    return resources.filter((resource) => {
      const type = String(resource.type || resource.resourceType || '').toUpperCase();
      if (types?.length && !types.includes(type)) return false;

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

  private isPassingAttempt(resource: any) {
    if (!resource.completed) return false;
    if (typeof resource.resultScore === 'number') return resource.resultScore >= 0.7;
    if (typeof resource.resultCorrect === 'number' && typeof resource.resultTotal === 'number' && resource.resultTotal > 0) {
      return resource.resultCorrect / resource.resultTotal >= 0.7;
    }
    return true;
  }

  private clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
  }
}
