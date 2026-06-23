import { Injectable } from '@nestjs/common';
import { AdaptiveSessionsRepository } from './adaptive-sessions.repository';

@Injectable()
export class AdaptiveSessionsService {
  constructor(private readonly repo: AdaptiveSessionsRepository) {}

  /**
   * Log an adaptive session with before/after snapshots and generated resources.
   */
  async logSession(userId: number, conversationId: any, payload: any, beforeSnapshot?: any, afterSnapshot?: any, generatedResourceIds?: any[], detectedGaps?: any[]) {
    const doc = { userId, conversationId, payload, beforeSnapshot, afterSnapshot, generatedResourceIds, detectedGaps };
    return this.repo.insert(doc);
  }
}
