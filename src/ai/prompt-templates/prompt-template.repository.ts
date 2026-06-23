import { Inject, Injectable } from '@nestjs/common';
import { Collection } from 'mongodb';
import { TEACHER_PROMPT_TEMPLATES_COLLECTION } from '../mongo.provider';

@Injectable()
export class PromptTemplateRepository {
  constructor(@Inject(TEACHER_PROMPT_TEMPLATES_COLLECTION) private readonly col: Collection) {}

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
}
