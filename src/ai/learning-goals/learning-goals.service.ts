import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { LearningGoalsRepository } from './learning-goals.repository';

@Injectable()
export class LearningGoalsService {
  constructor(private readonly repo: LearningGoalsRepository) {}

  async createGoal(userId: number, title: string, description: string, targetDate?: Date) {
    const doc = { userId, title, description, targetDate: targetDate || null, progress: 0, status: 'active' };
    const id = await this.repo.insert(doc);
    return this.serialize(await this.repo.findById(String(id)));
  }

  async listGoals(userId: number) {
    const rows = await this.repo.findByUser(userId);
    return rows.map((row) => this.serialize(row));
  }

  async getGoalForUser(userId: number, id: string) {
    const goal = await this.repo.findById(id);
    if (!goal) throw new NotFoundException('Meta no encontrada');
    if (goal.userId !== userId) throw new ForbiddenException('No tienes acceso a esta meta');
    return this.serialize(goal);
  }

  async updateGoalForUser(userId: number, id: string, patch: any) {
    await this.getGoalForUser(userId, id);
    const updated = await this.repo.update(id, patch);
    return this.serialize(updated);
  }

  async deleteGoalForUser(userId: number, id: string) {
    await this.getGoalForUser(userId, id);
    await this.repo.delete(id);
    return { ok: true };
  }

  async updateProgress(goalId: string, progress: number) {
    return this.repo.update(goalId, { progress });
  }

  async updateProgressFromSignals(userId: number, signals: any) {
    const goals = await this.repo.findByUser(userId);
    const activeGoals = (goals || []).filter((goal) => goal.status !== 'completed');
    const updates: any[] = [];

    for (const goal of activeGoals) {
      const subject = this.detectGoalSubject(goal, signals);
      const mastery = this.subjectValue(signals?.studentModel?.confidencePerSubject, subject, signals?.analytics?.masteryScore ?? 0.5);
      const confidence = this.subjectValue(signals?.analytics?.confidencePerSubject || signals?.studentModel?.confidencePerSubject, subject, 0.5);
      const gapPenalty = this.knowledgeGapPenalty(signals?.knowledgeGaps || [], subject);
      const sessionGrowth = this.sessionGrowth(signals?.adaptiveSessions || []);
      const completedResourceBoost = this.completedResourceBoost(signals?.generatedResources || [], subject);

      const progress = Math.round(Math.max(0, Math.min(100, (
        mastery * 0.4 +
        confidence * 0.25 +
        sessionGrowth * 0.15 +
        completedResourceBoost * 0.1 +
        (1 - gapPenalty) * 0.1
      ) * 100)));

      const updated = await this.repo.update(String(goal._id || goal.id), {
        progress,
        computedProgress: {
          subject,
          mastery,
          confidence,
          gapPenalty,
          sessionGrowth,
          completedResourceBoost,
        },
        status: progress >= 100 ? 'completed' : goal.status || 'active',
      });
      updates.push(updated);
    }

    return updates;
  }

  private serialize(goal: any) {
    if (!goal) return null;
    return {
      id: String(goal._id || goal.id),
      userId: goal.userId,
      title: goal.title,
      description: goal.description,
      targetDate: goal.targetDate,
      progress: goal.progress ?? 0,
      status: goal.status || 'active',
      computedProgress: goal.computedProgress || null,
      createdAt: goal.createdAt,
      updatedAt: goal.updatedAt,
    };
  }

  private detectGoalSubject(goal: any, signals: any) {
    const text = `${goal.title || ''} ${goal.description || ''}`.toLowerCase();
    const subjects = [
      ...Object.keys(signals?.studentModel?.subjectLevels || {}),
      ...Object.keys(signals?.analytics?.confidencePerSubject || {}),
      ...((signals?.knowledgeGaps || []).map((gap) => gap.subject).filter(Boolean)),
    ];
    return Array.from(new Set(subjects)).find((subject: any) => text.includes(String(subject).toLowerCase())) || subjects[0] || 'general';
  }

  private subjectValue(map: any, subject: string, fallback: number) {
    if (!map) return fallback;
    return typeof map[subject] === 'number' ? map[subject] : fallback;
  }

  private knowledgeGapPenalty(gaps: any[], subject: string) {
    const subjectGaps = (gaps || []).filter((gap) => !subject || gap.subject === subject || subject === 'general');
    if (!subjectGaps.length) return 0;
    const avg = subjectGaps.reduce((sum, gap) => sum + (gap.confidence || 0.5), 0) / subjectGaps.length;
    return Math.min(1, avg);
  }

  private sessionGrowth(sessions: any[]) {
    const recent = (sessions || []).slice(0, 10);
    if (!recent.length) return 0.3;
    const gains = recent.map((session) => {
      if (typeof session.masteryBefore !== 'number' || typeof session.masteryAfter !== 'number') return 0;
      return Math.max(0, session.masteryAfter - session.masteryBefore);
    });
    return Math.min(1, 0.3 + gains.reduce((sum, gain) => sum + gain, 0));
  }

  private completedResourceBoost(resources: any[], subject: string) {
    const relevant = (resources || []).filter((resource) => resource.completed && (!subject || resource.subject === subject || subject === 'general'));
    return Math.min(1, relevant.length / 5);
  }
}
