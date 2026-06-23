import { Inject, Injectable, Logger } from '@nestjs/common';
import { Collection } from 'mongodb';
import { LearningAnalyticsRepository } from './learning-analytics.repository';
import { MESSAGES_COLLECTION } from '../mongo.provider';

@Injectable()
export class LearningAnalyticsService {
  private readonly logger = new Logger(LearningAnalyticsService.name);

  constructor(private readonly repo: LearningAnalyticsRepository, @Inject(MESSAGES_COLLECTION) private readonly messages: Collection) {}

  async recordQuestion(userId: number, subject: string | null) {
    const subj = subject || 'general';
    const res = await this.repo.upsertForUserSubject(userId, subj, { questionsAsked: 1 });
    return res;
  }

  async recordAnswer(userId: number, subject: string | null, correct: boolean) {
    const subj = subject || 'general';
    const inc: any = { questionsAsked: 0, correctAnswers: 0 };
    if (correct) inc.correctAnswers = 1;
    const res = await this.repo.upsertForUserSubject(userId, subj, inc);
    return res;
  }

  /**
   * Return raw analytics documents plus computed aggregates used by pedagogical decisions.
   * - confidencePerSubject: map subject -> [0..1]
   * - masteryScore: overall aggregated mastery [0..1]
   * - struggleScore: overall measure of active struggle [0..1]
   * - engagementScore: based on recent message frequency [0..1]
   */
  async getAnalytics(userId: number) {
    const rows = await this.repo.findByUser(userId);

    const confidencePerSubject: Record<string, number> = {};
    let masteryNumerator = 0;
    let masteryDenominator = 0;
    let struggleAccum = 0;

    for (const r of rows || []) {
      const subj = r.subject || 'general';
      const q = r.questionsAsked || 0;
      const c = r.correctAnswers || 0;
      const conf = q > 0 ? Math.max(0, Math.min(1, c / q)) : 0.5;
      confidencePerSubject[subj] = conf;

      // weight by log(questions+1) so frequent practice counts more
      const weight = Math.log10(Math.max(1, q) + 1);
      masteryNumerator += conf * weight;
      masteryDenominator += weight;

      // struggle: many questions but low correctness increases struggle
      const struggle = q > 0 && conf < 0.7 ? (1 - conf) * Math.min(1, Math.log10(q + 1) / 2) : 0;
      struggleAccum += struggle * weight;
    }

    const masteryScore = masteryDenominator > 0 ? masteryNumerator / masteryDenominator : 0.5;
    const struggleScore = masteryDenominator > 0 ? Math.min(1, struggleAccum / masteryDenominator) : 0;

    // engagement: count of user messages in last 14 days normalized to [0..1]
    const twoWeeksAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 14);
    const msgCount = await this.messages.countDocuments({ userId, role: 'user', createdAt: { $gte: twoWeeksAgo } });
    // normalize: 0..50 -> 0..1
    const engagementScore = Math.min(1, msgCount / 50);

    return { raw: rows, confidencePerSubject, masteryScore, struggleScore, engagementScore };
  }
}
