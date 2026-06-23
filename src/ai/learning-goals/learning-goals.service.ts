import { Injectable } from '@nestjs/common';
import { LearningGoalsRepository } from './learning-goals.repository';

@Injectable()
export class LearningGoalsService {
  constructor(private readonly repo: LearningGoalsRepository) {}

  async createGoal(userId: number, title: string, description: string, targetDate?: Date) {
    const doc = { userId, title, description, targetDate: targetDate || null, progress: 0, status: 'active' };
    return this.repo.insert(doc);
  }

  async listGoals(userId: number) {
    return this.repo.findByUser(userId);
  }

  async updateProgress(goalId: string, progress: number) {
    return this.repo.update(goalId, { progress });
  }
}
