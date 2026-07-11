import { createHash } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { Collection } from 'mongodb';
import { KNOWLEDGE_VECTORS_COLLECTION } from '../mongo.provider';
import { KnowledgeVectorDocument, KnowledgeVectorSource } from './knowledge-vector.types';

export function hashKnowledgeText(text: string): string {
  return createHash('sha256').update(text.trim()).digest('hex');
}

@Injectable()
export class KnowledgeVectorsRepository {
  private indexesEnsured = false;

  constructor(@Inject(KNOWLEDGE_VECTORS_COLLECTION) private readonly col: Collection<KnowledgeVectorDocument>) {}

  private async ensureIndexesOnce() {
    if (this.indexesEnsured) return;
    try {
      await this.col.createIndex({ userId: 1, source: 1, sourceId: 1 }, { unique: true });
      await this.col.createIndex({ userId: 1, updatedAt: -1 });
    } catch {}
    this.indexesEnsured = true;
  }

  async findByUser(userId: number, limit = 5000): Promise<KnowledgeVectorDocument[]> {
    await this.ensureIndexesOnce();
    return this.col.find({ userId }).limit(limit).toArray();
  }

  async findOneBySource(userId: number, source: KnowledgeVectorSource, sourceId: string) {
    await this.ensureIndexesOnce();
    return this.col.findOne({ userId, source, sourceId });
  }

  async upsertVector(
    userId: number,
    source: KnowledgeVectorSource,
    sourceId: string,
    payload: Omit<KnowledgeVectorDocument, 'userId' | 'source' | 'sourceId' | 'createdAt' | 'updatedAt'>,
  ) {
    await this.ensureIndexesOnce();
    const now = new Date();
    const q = { userId, source, sourceId };
    const update = {
      $setOnInsert: { userId, source, sourceId, createdAt: now },
      $set: { ...payload, updatedAt: now },
    };
    const res = await this.col.findOneAndUpdate(q, update, { upsert: true, returnDocument: 'after' });
    return res.value;
  }

  async deleteBySource(userId: number, source: KnowledgeVectorSource, sourceId: string) {
    await this.ensureIndexesOnce();
    await this.col.deleteOne({ userId, source, sourceId });
  }
}
