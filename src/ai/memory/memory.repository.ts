import { Inject, Injectable } from '@nestjs/common';
import { Collection, ObjectId } from 'mongodb';
import { MEMORIES_COLLECTION } from '../mongo.provider';

@Injectable()
export class MemoryRepository {
  constructor(@Inject(MEMORIES_COLLECTION) private readonly memories: Collection) {}

  async insert(doc: any) {
    const res = await this.memories.insertOne(doc);
    return res.insertedId;
  }

  async update(id: string | ObjectId, update: any) {
    const oid = typeof id === 'string' ? new ObjectId(id) : id;
    await this.memories.updateOne({ _id: oid }, { $set: update });
  }

  async delete(id: string | ObjectId) {
    const oid = typeof id === 'string' ? new ObjectId(id) : id;
    await this.memories.deleteOne({ _id: oid });
  }

  async findByUser(userId: number) {
    return this.memories.find({ userId }).sort({ updatedAt: -1 }).toArray();
  }

  async findRelevant(userId: number, keywords: string[], limit = 10) {
    if (!keywords || !keywords.length) return [];
    const regex = keywords.map((k) => `(?=.*${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`).join('');
    const q = { userId, $or: [{ key: { $regex: regex, $options: 'i' } }, { value: { $regex: regex, $options: 'i' } }] };
    return this.memories.find(q).sort({ confidence: -1, updatedAt: -1 }).limit(limit).toArray();
  }
}
