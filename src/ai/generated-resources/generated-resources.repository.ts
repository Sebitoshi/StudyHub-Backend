import { Inject, Injectable } from '@nestjs/common';
import { Collection, ObjectId } from 'mongodb';
import { GENERATED_RESOURCES_COLLECTION } from '../mongo.provider';

@Injectable()
export class GeneratedResourcesRepository {
  constructor(@Inject(GENERATED_RESOURCES_COLLECTION) private readonly col: Collection) {}

  async insert(doc: any) {
    const _id = doc._id || new ObjectId();
    const now = new Date();
    const res = await this.col.insertOne({ ...doc, _id, id: String(_id), createdAt: now });
    return res.insertedId;
  }

  async findByUser(userId: number) {
    return this.col.find({ userId }).sort({ createdAt: -1 }).toArray();
  }

  async countCompletedByUser(userId: number) {
    return this.col.countDocuments({ userId, completed: true });
  }
}
