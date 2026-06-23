import { Inject, Injectable } from '@nestjs/common';
import { Collection, ObjectId } from 'mongodb';
import { TEACHER_PROFILES_COLLECTION } from '../mongo.provider';

@Injectable()
export class TeacherProfileRepository {
  constructor(@Inject(TEACHER_PROFILES_COLLECTION) private readonly col: Collection) {}

  async insert(doc: any) {
    const res = await this.col.insertOne(doc);
    return res.insertedId;
  }

  async findByCode(code: string) {
    return this.col.findOne({ code });
  }

  async findAll() {
    return this.col.find({}).toArray();
  }

  async findBySubject(subjectName: string) {
    return this.col.find({ subjects: { $in: [subjectName] } }).toArray();
  }
}
