import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EmbeddingsProvider, KnowledgeItem, SemanticSearchResult, VectorStore } from '../knowledge-gap-detector.contract';
import { cosineSimilarity } from '../cosine.util';
import { KnowledgeVectorsRepository } from '../knowledge-vectors.repository';
import { KnowledgeVectorSource } from '../knowledge-vector.types';

@Injectable()
export class MongoCosineVectorStore implements VectorStore, OnModuleInit {
  private readonly logger = new Logger(MongoCosineVectorStore.name);

  constructor(private readonly vectorsRepo: KnowledgeVectorsRepository) {}

  async onModuleInit() {
    try {
      await this.vectorsRepo.ensureIndexes();
    } catch (err) {
      this.logger.warn('Failed to ensure knowledge_vectors indexes: ' + err);
    }
  }

  async upsert(userId: number, items: Array<KnowledgeItem & { embedding: number[] }>): Promise<void> {
    for (const item of items) {
      const source = (item.metadata?.source || 'memory') as KnowledgeVectorSource;
      const sourceId = item.metadata?.sourceId || item.id;
      const topic = item.metadata?.topic || item.text.slice(0, 80);
      const subject = item.metadata?.subject || null;
      const textHash = item.metadata?.textHash;

      await this.vectorsRepo.upsertVector(userId, source, sourceId, {
        topic,
        subject,
        text: item.text,
        textHash,
        embedding: item.embedding,
        metadata: item.metadata || {},
      });
    }
  }

  async query(userId: number, embedding: number[], topK = 10): Promise<SemanticSearchResult[]> {
    if (!embedding?.length) return [];

    const docs = await this.vectorsRepo.findByUser(userId);
    const scored = docs
      .map((doc) => ({
        id: `${doc.source}:${doc.sourceId}`,
        text: doc.text,
        score: cosineSimilarity(embedding, doc.embedding),
        metadata: {
          ...(doc.metadata || {}),
          source: doc.source,
          sourceId: doc.sourceId,
          topic: doc.topic,
          subject: doc.subject,
        },
      }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return scored;
  }
}
