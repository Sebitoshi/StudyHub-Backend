import { Injectable } from '@nestjs/common';
import { GeneratedResourcesRepository } from './generated-resources.repository';

@Injectable()
export class GeneratedResourcesService {
  constructor(private readonly repo: GeneratedResourcesRepository) {}

  async saveResource(userId: number, conversationId: any, resourceType: string, title: string, content: any, metadata: any = {}) {
    const type = String(resourceType || '').toUpperCase();
    const doc = {
      userId,
      conversationId,
      subject: metadata.subject || 'general',
      type,
      resourceType: type,
      title,
      content,
      sourceKnowledgeGap: metadata.sourceKnowledgeGap || null,
      completed: metadata.completed ?? false,
      completedAt: metadata.completedAt || null,
      trigger: metadata.trigger || null,
    };
    return this.repo.insert(doc);
  }

  async listForUser(userId: number) {
    return this.repo.findByUser(userId);
  }

  async countCompletedForUser(userId: number) {
    return this.repo.countCompletedByUser(userId);
  }
}
