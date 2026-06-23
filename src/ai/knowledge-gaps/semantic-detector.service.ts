import { Inject, Injectable, Logger } from '@nestjs/common';
import { Collection } from 'mongodb';
import { MESSAGES_COLLECTION } from '../mongo.provider';
import {
  EMBEDDINGS_PROVIDER,
  KnowledgeGapDetectOptions,
  KnowledgeItem,
  SemanticSearchResult,
  VECTOR_STORE,
} from './knowledge-gap-detector.contract';
import type { EmbeddingsProvider, KnowledgeGapDetector, VectorStore } from './knowledge-gap-detector.contract';
import { cosineSimilarity } from './cosine.util';
import { DetectedGapCandidate } from './knowledge-vector.types';
import { KnowledgeIndexerService } from './knowledge-indexer.service';

const GAP_MEMORY_TYPES = new Set(['KNOWLEDGE_GAP', 'RECURRING_MISTAKE', 'WEAK_SKILL']);

@Injectable()
export class SemanticDetectorService implements KnowledgeGapDetector {
  private readonly logger = new Logger(SemanticDetectorService.name);

  constructor(
    @Inject(EMBEDDINGS_PROVIDER) private readonly embeddings: EmbeddingsProvider,
    @Inject(VECTOR_STORE) private readonly vectorStore: VectorStore,
    private readonly indexer: KnowledgeIndexerService,
    @Inject(MESSAGES_COLLECTION) private readonly messages: Collection,
  ) {}

  async detect(userId: number, academicContext: any, options: KnowledgeGapDetectOptions = {}): Promise<DetectedGapCandidate[]> {
    if (!this.embeddings.isConfigured?.()) {
      this.logger.debug('Embeddings provider not configured; skipping semantic detection');
      return [];
    }

    try {
      if (!options.skipIndex) {
        await this.indexer.syncUserKnowledge(userId, academicContext);
      }

      const message = (options.message || '').trim();
      const recentMessages = await this.getRecentUserMessages(userId, options.conversationId);
      const queries = message ? [message, ...recentMessages.filter((row) => row !== message)] : recentMessages;
      if (!queries.length) return [];

      const candidates = new Map<string, DetectedGapCandidate>();

      for (const query of queries.slice(0, 8)) {
        const hits = await this.querySimilar(userId, query, 10);
        this.collectHits(candidates, hits, query, academicContext);
      }

      await this.collectRecurringQuestionClusters(userId, queries.slice(0, 6), candidates, academicContext);

      return Array.from(candidates.values()).sort((a, b) => b.confidence - a.confidence);
    } catch (err) {
      this.logger.warn('Semantic gap detection failed: ' + err);
      return [];
    }
  }

  async indexKnowledge(userId: number, items: KnowledgeItem[]): Promise<boolean> {
    if (!this.embeddings.isConfigured?.()) return false;
    if (!items.length) return true;

    const embeddings = await this.embeddings.embedBatch(items.map((item) => item.text));
    const enriched = items
      .map((item, index) => ({ ...item, embedding: embeddings[index] }))
      .filter((item) => item.embedding?.length);

    await this.vectorStore.upsert(userId, enriched);
    return true;
  }

  async querySimilar(userId: number, query: string, topK = 10): Promise<SemanticSearchResult[]> {
    if (!this.embeddings.isConfigured?.()) return [];
    const trimmed = (query || '').trim();
    if (!trimmed) return [];

    const embedding = await this.embeddings.embed(trimmed);
    return this.vectorStore.query(userId, embedding, topK);
  }

  private collectHits(
    candidates: Map<string, DetectedGapCandidate>,
    hits: SemanticSearchResult[],
    query: string,
    academicContext: any,
  ) {
    for (const hit of hits) {
      if (hit.score < 0.55) continue;

      const memoryType = hit.metadata?.memoryType;
      const topic = String(hit.metadata?.topic || hit.text).slice(0, 120);
      const subject = this.resolveSubject(hit, academicContext);
      const key = `${subject}::${topic.toLowerCase()}`;

      const evidence: string[] = [`semantic:query:${query.slice(0, 80)}`, `semantic:match:${hit.score.toFixed(2)}`];
      if (memoryType && GAP_MEMORY_TYPES.has(memoryType)) {
        evidence.push(`semantic:memory:${memoryType}`);
      }

      let confidence = Math.min(0.55 + hit.score * 0.35, 0.95);
      if (memoryType && GAP_MEMORY_TYPES.has(memoryType)) {
        confidence = Math.min(confidence + 0.08, 0.97);
      }

      this.mergeCandidate(candidates, key, {
        subject,
        topic,
        confidence,
        evidence,
        source: 'semantic',
      });
    }
  }

  private async collectRecurringQuestionClusters(
    userId: number,
    queries: string[],
    candidates: Map<string, DetectedGapCandidate>,
    academicContext: any,
  ) {
    if (queries.length < 2) return;

    const embeddings = await this.embeddings.embedBatch(queries);
    const clusters = new Map<string, { topic: string; subject: string; count: number; evidence: string[] }>();

    for (let i = 0; i < queries.length; i++) {
      for (let j = i + 1; j < queries.length; j++) {
        const score = cosineSimilarity(embeddings[i], embeddings[j]);
        if (score < 0.72) continue;

        const hits = await this.vectorStore.query(userId, embeddings[i], 3);
        const best = hits[0];
        const topic = String(best?.metadata?.topic || queries[i]).slice(0, 120);
        const subject = best ? this.resolveSubject(best, academicContext) : this.resolveSubjectFromText(queries[i], academicContext);
        const key = `${subject}::${topic.toLowerCase()}`;

        const existing = clusters.get(key) || { topic, subject, count: 0, evidence: [] };
        existing.count += 1;
        existing.evidence.push(`semantic:cluster:${score.toFixed(2)}`);
        clusters.set(key, existing);
      }
    }

    for (const cluster of clusters.values()) {
      if (cluster.count < 1) continue;
      const questionCount = cluster.count + 1;
      const confidence = Math.min(0.62 + questionCount * 0.08, 0.94);
      const key = `${cluster.subject}::${cluster.topic.toLowerCase()}`;
      this.mergeCandidate(candidates, key, {
        subject: cluster.subject,
        topic: cluster.topic,
        confidence,
        evidence: [`semantic:similar_questions:${questionCount}`, ...cluster.evidence],
        source: 'semantic',
      });
    }
  }

  private mergeCandidate(candidates: Map<string, DetectedGapCandidate>, key: string, incoming: DetectedGapCandidate) {
    const existing = candidates.get(key);
    if (!existing) {
      candidates.set(key, incoming);
      return;
    }

    candidates.set(key, {
      ...existing,
      confidence: Math.min(Math.max(existing.confidence, incoming.confidence) + 0.03, 0.98),
      evidence: Array.from(new Set([...(existing.evidence || []), ...(incoming.evidence || [])])),
    });
  }

  private resolveSubject(hit: SemanticSearchResult, academicContext: any): string {
    if (hit.metadata?.subject) return String(hit.metadata.subject);
    return this.resolveSubjectFromText(hit.text, academicContext);
  }

  private resolveSubjectFromText(text: string, academicContext: any): string {
    const normalized = (text || '').toLowerCase();
    for (const subject of academicContext?.subjects || []) {
      if (subject.name && normalized.includes(String(subject.name).toLowerCase())) {
        return subject.name;
      }
    }
    return 'general';
  }

  private async getRecentUserMessages(userId: number, conversationId?: string) {
    const filter: any = { userId, role: 'user' };
    if (conversationId) filter.conversationId = conversationId;

    const rows = await this.messages.find(filter).sort({ createdAt: -1 }).limit(12).toArray();
    return rows.map((row) => String(row.content || '').trim()).filter(Boolean);
  }
}
