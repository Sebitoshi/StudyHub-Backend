import { Inject, Injectable } from '@nestjs/common';
import { Collection } from 'mongodb';
import { LEARNING_PATHS_COLLECTION } from '../mongo.provider';

@Injectable()
export class LearningPathsRepository {
  constructor(@Inject(LEARNING_PATHS_COLLECTION) private readonly col: Collection) {}

  async insert(doc: any) {
    const now = new Date();
    const res = await this.col.insertOne({ ...doc, createdAt: now, updatedAt: now });
    return res.insertedId;
  }

  async findByUser(userId: number) {
    return this.col.find({ userId }).sort({ updatedAt: -1 }).toArray();
  }
}
