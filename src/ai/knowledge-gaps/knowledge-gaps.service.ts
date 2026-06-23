import { Inject, Injectable, Logger } from '@nestjs/common';
import { Collection } from 'mongodb';
import { GeneratedResourcesRepository } from '../generated-resources/generated-resources.repository';
import { LearningAnalyticsService } from '../learning-analytics/learning-analytics.service';
import { MemoryRepository } from '../memory/memory.repository';
import { MESSAGES_COLLECTION } from '../mongo.provider';
import { KNOWLEDGE_GAP_DETECTOR, KnowledgeGapDetectOptions } from './knowledge-gap-detector.contract';
import type { KnowledgeGapDetector } from './knowledge-gap-detector.contract';
import { DetectedGapCandidate } from './knowledge-vector.types';
import { GapConfidenceEngine } from './gap-confidence.engine';
import { GapRecoveryService } from './gap-recovery.service';
import { KnowledgeGapsRepository } from './knowledge-gaps.repository';

@Injectable()
export class KnowledgeGapsService {
  private readonly logger = new Logger(KnowledgeGapsService.name);

  constructor(
    private readonly repo: KnowledgeGapsRepository,
    private readonly memoryRepo: MemoryRepository,
    private readonly resourcesRepo: GeneratedResourcesRepository,
    private readonly analyticsService: LearningAnalyticsService,
    private readonly confidenceEngine: GapConfidenceEngine,
    private readonly recoveryService: GapRecoveryService,
    @Inject(MESSAGES_COLLECTION) private readonly messages: Collection,
    @Inject(KNOWLEDGE_GAP_DETECTOR) private readonly semanticDetector: KnowledgeGapDetector,
  ) {}

  /**
   * Hybrid detector: semantic V2 + heuristic V1 + confidence engine + recovery.
   */
  async detectAndUpsertGaps(userId: number, academicContext: any, options: KnowledgeGapDetectOptions = {}) {
    const heuristicCandidates = await this.detectHeuristicV1(userId, academicContext);
    let semanticCandidates: DetectedGapCandidate[] = [];

    try {
      semanticCandidates = await this.semanticDetector.detect(userId, academicContext, options);
    } catch (err) {
      this.logger.warn('Semantic detector failed, continuing with heuristics only: ' + err);
    }

    const merged = this.mergeCandidates(heuristicCandidates, semanticCandidates);
    const [analytics, resources] = await Promise.all([
      this.analyticsService.getAnalytics(userId),
      this.resourcesRepo.findByUser(userId),
    ]);

    const created: any[] = [];
    const detectedKeys = new Set<string>();

    for (const candidate of merged) {
      const key = this.gapKey(candidate.subject, candidate.topic);
      detectedKeys.add(key);

      const existing = await this.repo.findByKey(userId, candidate.subject, candidate.topic);
      const scored = this.confidenceEngine.compute({
        candidate,
        analytics,
        resources,
        existingGap: existing,
      });

      const status = this.resolveInitialStatus(existing, scored.confidence);
      const up = await this.repo.upsert(userId, candidate.subject, candidate.topic, {
        confidence: scored.confidence,
        status,
        evidence: scored.evidence,
      });
      created.push(up);
    }

    await this.processRecovery(userId, analytics, resources, detectedKeys);
    return created;
  }

  async processRecovery(userId: number, analytics?: any, resources?: any[], detectedKeys?: Set<string>) {
    const resolvedAnalytics = analytics || (await this.analyticsService.getAnalytics(userId));
    const resolvedResources = resources || (await this.resourcesRepo.findByUser(userId));
    const gaps = await this.repo.findActive(userId);

    for (const gap of gaps) {
      const key = this.gapKey(gap.subject, gap.topic);
      const stillDetected = detectedKeys ? detectedKeys.has(key) : gap.status !== 'RESOLVED';

      const recovery = this.recoveryService.evaluate({
        gap,
        analytics: resolvedAnalytics,
        resources: resolvedResources,
        stillDetected,
        currentConfidence: gap.confidence,
      });

      if (recovery.status !== gap.status || recovery.confidence !== gap.confidence || recovery.evidence.length !== (gap.evidence || []).length) {
        await this.repo.updateById(String(gap._id), {
          status: recovery.status,
          confidence: recovery.confidence,
          evidence: recovery.evidence,
        });
      }
    }
  }

  async onResourceCompleted(userId: number, resource: any) {
    const analytics = await this.analyticsService.getAnalytics(userId);
    const resources = await this.resourcesRepo.findByUser(userId);
    await this.processRecovery(userId, analytics, resources);
    return resource;
  }

  private resolveInitialStatus(existing: any, confidence: number) {
    if (!existing) return 'DETECTED';
    if (existing.status === 'RESOLVED' && confidence >= 0.6) return 'DETECTED';
    if (existing.status === 'IMPROVING' && confidence < 0.75) return 'IMPROVING';
    return 'DETECTED';
  }

  private gapKey(subject: string, topic: string) {
    return `${subject || 'general'}::${String(topic || '').toLowerCase()}`;
  }

  private async detectHeuristicV1(userId: number, academicContext: any): Promise<DetectedGapCandidate[]> {
    const created: DetectedGapCandidate[] = [];

    const mems = await this.memoryRepo.findByUser(userId);
    const relevant = (mems || []).filter((m) => ['KNOWLEDGE_GAP', 'RECURRING_MISTAKE', 'WEAK_SKILL'].includes(m.type));
    for (const m of relevant) {
      const subject = m.key.includes(':') ? m.key.split(':')[1] : academicContext?.subjects?.[0]?.name || 'general';
      const topic = m.value || m.key;
      created.push({
        subject,
        topic,
        confidence: Math.min((m.confidence || 0.6) + 0.1, 0.95),
        evidence: [`memory:${m._id}`],
        source: 'heuristic',
      });
    }

    const recentMsgs = await this.messages.find({ userId, role: 'user' }).sort({ createdAt: -1 }).limit(500).toArray();
    const texts = recentMsgs.map((r) => (r.content || '').toLowerCase());
    const freq: Record<string, number> = {};
    for (const t of texts) {
      const words = t.replace(/[^a-z0-9áéíóúñ ]/gi, ' ').split(/\s+/).filter(Boolean);
      for (let i = 0; i < Math.min(words.length, 8); i++) {
        const w = words[i];
        if (w.length < 4) continue;
        freq[w] = (freq[w] || 0) + 1;
      }
    }

    for (const [token, count] of Object.entries(freq)) {
      if (count >= 3) {
        const subj = academicContext?.subjects?.find((s) => (s.name || '').toLowerCase().includes(token))?.name || 'general';
        created.push({
          subject: subj,
          topic: token,
          confidence: Math.min(0.4 + Math.min(count / 10, 0.5), 0.9),
          evidence: [`messages:token:${token}`],
          source: 'heuristic',
        });
      }
    }

    try {
      const subjects = academicContext?.subjects || [];
      const recentNotes = academicContext?.recentNotes || [];
      for (const s of subjects) {
        const name = (s.name || '').toLowerCase();
        const keywords = new Set<string>();
        if (name) keywords.add(name);
        for (const task of s.tasksPending || []) {
          String(task.title || '')
            .split(/\W+/)
            .forEach((w) => w.length > 3 && keywords.add(w.toLowerCase()));
        }
        for (const note of recentNotes.filter((n: any) => n.subjectId === s.id)) {
          String(note.snippet || note.title || '')
            .split(/\W+/)
            .forEach((w) => w.length > 3 && keywords.add(w.toLowerCase()));
        }

        const asked = new Set<string>(Object.keys(freq));
        const missing: string[] = [];
        for (const k of Array.from(keywords)) {
          if (!asked.has(k) && k.length > 3) missing.push(k);
        }

        for (const mtopic of missing.slice(0, 3)) {
          created.push({
            subject: s.name,
            topic: mtopic,
            confidence: 0.2,
            evidence: [`missing:subject:${s.name}`],
            source: 'heuristic',
          });
        }
      }
    } catch (err) {
      this.logger.warn('Subject missing detection failed: ' + err);
    }

    return created;
  }

  private mergeCandidates(heuristic: DetectedGapCandidate[], semantic: DetectedGapCandidate[]): DetectedGapCandidate[] {
    const merged = new Map<string, DetectedGapCandidate>();

    for (const candidate of [...heuristic, ...semantic]) {
      const key = this.gapKey(candidate.subject, candidate.topic);
      const existing = merged.get(key);
      if (!existing) {
        merged.set(key, candidate);
        continue;
      }

      const bothSources = existing.source !== candidate.source;
      merged.set(key, {
        subject: existing.subject,
        topic: existing.topic,
        confidence: Math.min(Math.max(existing.confidence, candidate.confidence) + (bothSources ? 0.05 : 0), 0.98),
        evidence: Array.from(new Set([...(existing.evidence || []), ...(candidate.evidence || [])])),
        source: bothSources ? existing.source : candidate.source,
      });
    }

    return Array.from(merged.values());
  }

  async getTopGaps(userId: number, limit = 5) {
    return this.repo.findTop(userId, limit);
  }

  async list(userId: number) {
    return this.repo.findByUser(userId, 200);
  }

  async listIncludingResolved(userId: number) {
    return this.repo.findActive(userId);
  }

  async listBySubject(userId: number, subject: string) {
    return this.repo.findByUserAndSubject(userId, subject);
  }

  async patch(id: string, update: any) {
    return this.repo.updateById(id, update);
  }
}
