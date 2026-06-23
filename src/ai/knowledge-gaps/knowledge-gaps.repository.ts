import { Inject, Injectable } from '@nestjs/common';
import { Collection, ObjectId } from 'mongodb';
import { KNOWLEDGE_GAPS_COLLECTION } from '../mongo.provider';

@Injectable()
export class KnowledgeGapsRepository {
  constructor(@Inject(KNOWLEDGE_GAPS_COLLECTION) private readonly col: Collection) {}

  async insert(doc: any) {
    const res = await this.col.insertOne(doc);
    return res.insertedId;
  }

  async upsert(userId: number, subject: string, topic: string, doc: any) {
    const q = { userId, subject, topic };
    const update = { $setOnInsert: { userId, subject, topic, createdAt: new Date() }, $set: { updatedAt: new Date(), ...doc } };
    const res = await this.col.findOneAndUpdate(q, update, { upsert: true, returnDocument: 'after' });
    return res.value;
  }

  async findByKey(userId: number, subject: string, topic: string) {
    return this.col.findOne({ userId, subject, topic });
  }

  async findActive(userId: number) {
    return this.col.find({ userId, status: { $in: ['DETECTED', 'IMPROVING', 'RESOLVED'] } }).toArray();
  }

  async findByUser(userId: number, limit = 50) {
    return this.col.find({ userId }).sort({ confidence: -1, updatedAt: -1 }).limit(limit).toArray();
  }

  async findByUserAndSubject(userId: number, subject: string) {
    return this.col.find({ userId, subject }).sort({ confidence: -1, updatedAt: -1 }).toArray();
  }

  async findTop(userId: number, limit = 5) {
    return this.col.find({ userId, status: { $in: ['DETECTED', 'IMPROVING'] } }).sort({ confidence: -1 }).limit(limit).toArray();
  }

  async updateById(id: string, update: any) {
    const _id = new ObjectId(id);
    await this.col.updateOne({ _id }, { $set: { ...update, updatedAt: new Date() } });
    return this.col.findOne({ _id });
  }
}
