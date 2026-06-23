import { Injectable } from '@nestjs/common';
import { AdaptiveSessionsRepository } from './adaptive-sessions.repository';

@Injectable()
export class AdaptiveSessionsService {
  constructor(private readonly repo: AdaptiveSessionsRepository) {}

  /**
   * Log an adaptive session with before/after snapshots and generated resources.
   */
  async logSession(userId: number, conversationId: any, payload: any, beforeSnapshot?: any, afterSnapshot?: any, generatedResourceIds?: any[], detectedGaps?: any[]) {
    const now = new Date();
    const doc = {
      userId,
      conversationId,
      startedAt: payload?.startedAt || now,
      endedAt: payload?.endedAt || now,
      masteryBefore: this.extractMastery(beforeSnapshot),
      masteryAfter: this.extractMastery(afterSnapshot),
      knowledgeGapsDetected: detectedGaps || payload?.knowledgeGapsDetected || [],
      resourcesGenerated: generatedResourceIds || payload?.resourcesGenerated || [],
      learningGoalProgress: payload?.learningGoalProgress || [],
      teachingStrategy: payload?.teachingStrategy || payload?.adaptive?.mode || null,
      payload,
      beforeSnapshot,
      afterSnapshot,
      generatedResourceIds,
      detectedGaps,
    };
    return this.repo.insert(doc);
  }

  async listForUser(userId: number, limit = 100) {
    return this.repo.findByUser(userId, limit);
  }

  private extractMastery(snapshot: any) {
    if (!snapshot) return null;
    const latest = snapshot.snapshots?.[snapshot.snapshots.length - 1];
    return latest?.masteryScore ?? snapshot.masteryScore ?? null;
  }
}
