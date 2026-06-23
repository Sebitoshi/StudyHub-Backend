import { Inject, Injectable } from '@nestjs/common';
import { Collection } from 'mongodb';
import { ADAPTIVE_SESSIONS_COLLECTION } from '../mongo.provider';

@Injectable()
export class AdaptiveSessionsRepository {
  constructor(@Inject(ADAPTIVE_SESSIONS_COLLECTION) private readonly col: Collection) {}

  async insert(doc: any) {
    const now = new Date();
    const res = await this.col.insertOne({ ...doc, createdAt: now, updatedAt: now });
    return res.insertedId;
  }

  async findByUser(userId: number, limit = 100) {
    return this.col.find({ userId }).sort({ createdAt: -1 }).limit(limit).toArray();
  }
}
