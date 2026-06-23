import { Inject, Injectable } from '@nestjs/common';
import { Collection, ObjectId } from 'mongodb';
import { LEARNING_GOALS_COLLECTION } from '../mongo.provider';

@Injectable()
export class LearningGoalsRepository {
  constructor(@Inject(LEARNING_GOALS_COLLECTION) private readonly col: Collection) {}

  async insert(doc: any) {
    const now = new Date();
    const res = await this.col.insertOne({ ...doc, createdAt: now, updatedAt: now });
    return res.insertedId;
  }

  async findByUser(userId: number) {
    return this.col.find({ userId }).sort({ createdAt: -1 }).toArray();
  }

  async findById(id: string) {
    return this.col.findOne({ _id: new ObjectId(id) });
  }

  async delete(id: string) {
    return this.col.deleteOne({ _id: new ObjectId(id) });
  }

  async update(id: string, patch: any) {
    const _id = new ObjectId(id);
    await this.col.updateOne({ _id }, { $set: { ...patch, updatedAt: new Date() } });
    return this.col.findOne({ _id });
  }
}
