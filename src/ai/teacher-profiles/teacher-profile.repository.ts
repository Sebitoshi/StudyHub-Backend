import { Inject, Injectable } from '@nestjs/common';
import { Collection, ObjectId } from 'mongodb';
import { TEACHER_PROFILES_COLLECTION } from '../mongo.provider';

@Injectable()
export class TeacherProfileRepository {
  constructor(@Inject(TEACHER_PROFILES_COLLECTION) private readonly col: Collection) {}

  async insert(doc: any) {
    const now = new Date();
    const res = await this.col.insertOne({ ...doc, createdAt: now, updatedAt: now });
    return res.insertedId;
  }

  async findByCode(code: string) {
    return this.col.findOne({ code });
  }

  async findById(id: string) {
    return this.col.findOne({ _id: new ObjectId(id) });
  }

  async findByUserId(userId: number) {
    return this.col.find({ userId }).sort({ createdAt: -1 }).toArray();
  }

  async findAll() {
    return this.col.find({}).toArray();
  }

  async findBySubject(subjectName: string) {
    return this.col.find({ subjects: { $in: [subjectName] } }).toArray();
  }

  async update(id: string, patch: any) {
    const _id = new ObjectId(id);
    await this.col.updateOne({ _id }, { $set: { ...patch, updatedAt: new Date() } });
    return this.col.findOne({ _id });
  }
}
