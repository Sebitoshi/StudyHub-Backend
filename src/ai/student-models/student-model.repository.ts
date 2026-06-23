import { Inject, Injectable } from '@nestjs/common';
import { Collection, ObjectId } from 'mongodb';
import { STUDENT_MODELS_COLLECTION } from '../mongo.provider';

@Injectable()
export class StudentModelRepository {
  constructor(@Inject(STUDENT_MODELS_COLLECTION) private readonly col: Collection) {}

  async upsert(userId: number, doc: any) {
    const q = { userId };
    const update = { $set: { ...doc, userId, lastUpdated: new Date() }, $setOnInsert: { createdAt: new Date() } };
    const res = await this.col.findOneAndUpdate(q, update, { upsert: true, returnDocument: 'after' });
    return res.value;
  }

  async findByUser(userId: number) {
    return this.col.findOne({ userId });
  }
}
