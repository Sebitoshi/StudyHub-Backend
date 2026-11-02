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

  async findById(id: string) {
    return this.col.findOne({ _id: new ObjectId(id) });
  }

  /**
   * Solo el resumen de quizzes y simulacros ya completados. Se proyectan los
   * campos que necesita el contexto del chat, no las preguntas completas.
   */
  async findCompletedAssessments(userId: number, limit = 8) {
    return this.col
      .find(
        {
          userId,
          completed: true,
          $or: [
            { type: 'QUIZ' },
            { type: 'SIMULACRO' },
            { trigger: 'SIMULACRO_TAB' },
          ],
        },
        {
          projection: {
            title: 1,
            subject: 1,
            trigger: 1,
            type: 1,
            completedAt: 1,
            createdAt: 1,
            resultScore: 1,
            resultCorrect: 1,
            resultTotal: 1,
          },
        },
      )
      .sort({ completedAt: -1 })
      .limit(limit)
      .toArray();
  }

  async deleteById(id: string) {
    return this.col.deleteOne({ _id: new ObjectId(id) });
  }

  async markCompleted(id: string, result: { resultScore?: number; resultCorrect?: number; resultTotal?: number } = {}) {
    const now = new Date();
    await this.col.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          completed: true,
          completedAt: now,
          resultScore: result.resultScore ?? null,
          resultCorrect: result.resultCorrect ?? null,
          resultTotal: result.resultTotal ?? null,
          updatedAt: now,
        },
      },
    );
    return this.findById(id);
  }

  async countCompletedByUser(userId: number) {
    return this.col.countDocuments({ userId, completed: true });
  }
}
