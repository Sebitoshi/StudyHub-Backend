import { Inject, Injectable } from '@nestjs/common';
import { Collection, ObjectId } from 'mongodb';
import { LEARNING_GOALS_COLLECTION } from '../mongo.provider';

@Injectable()
export class LearningGoalsRepository {
  constructor(@Inject(LEARNING_GOALS_COLLECTION) private readonly col: Collection) {}

  async insert(doc: any) {
    if (!this.col) return null;
    const now = new Date();
    const res = await this.col.insertOne({ ...doc, createdAt: now, updatedAt: now });
    return res.insertedId;
  }

  async findByUser(userId: number) {
    if (!this.col) return [];
    return this.col.find({ userId }).sort({ createdAt: -1 }).toArray();
  }

  async findByUserId(id: number) {
    if (!this.col) return null;
    return this.col.findOne({ userId: id });
  }

  async findById(id: string) {
    if (!this.col) return null;
    return this.col.findOne({ _id: new ObjectId(id) });
  }

  async delete(id: string) {
    if (!this.col) return null;
    return this.col.deleteOne({ _id: new ObjectId(id) });
  }

  async update(id: string, patch: any) {
    if (!this.col) return null;
    const _id = new ObjectId(id);
    await this.col.updateOne({ _id }, { $set: { ...patch, updatedAt: new Date() } });
    return this.col.findOne({ _id });
  }
}
