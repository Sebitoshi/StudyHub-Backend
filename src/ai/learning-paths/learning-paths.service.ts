import { Injectable } from '@nestjs/common';
import { LearningPathsRepository } from './learning-paths.repository';

@Injectable()
export class LearningPathsService {
  constructor(private readonly repo: LearningPathsRepository) {}

  async createPath(userId: number, subject: string, goal: string, steps: any[]) {
    const doc = { userId, subject, goal, steps, progress: 0, status: 'ACTIVE' };
    const id = await this.repo.insert(doc);
    return id;
  }

  async list(userId: number) {
    return this.repo.findByUser(userId);
  }
}
