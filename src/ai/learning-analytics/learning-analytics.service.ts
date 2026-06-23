import { Injectable, Logger } from '@nestjs/common';
import { LearningAnalyticsRepository } from './learning-analytics.repository';

@Injectable()
export class LearningAnalyticsService {
  private readonly logger = new Logger(LearningAnalyticsService.name);

  constructor(private readonly repo: LearningAnalyticsRepository) {}

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

  async getAnalytics(userId: number) {
    return this.repo.findByUser(userId);
  }
}
