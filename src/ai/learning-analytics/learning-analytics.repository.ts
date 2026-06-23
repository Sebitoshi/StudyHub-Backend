import { Inject, Injectable } from '@nestjs/common';
import { Collection } from 'mongodb';
import { LEARNING_ANALYTICS_COLLECTION } from '../mongo.provider';

@Injectable()
export class LearningAnalyticsRepository {
  constructor(@Inject(LEARNING_ANALYTICS_COLLECTION) private readonly col: Collection) {}

  async upsertForUserSubject(userId: number, subject: string, update: any) {
    const q = { userId, subject };
    const res = await this.col.findOneAndUpdate(q, { $setOnInsert: { userId, subject, createdAt: new Date() }, $inc: update, $set: { updatedAt: new Date() } }, { upsert: true, returnDocument: 'after' });
    return res.value;
  }

  async findByUser(userId: number) {
    return this.col.find({ userId }).toArray();
  }

  async find(userId: number, subject: string) {
    return this.col.findOne({ userId, subject });
  }
}
