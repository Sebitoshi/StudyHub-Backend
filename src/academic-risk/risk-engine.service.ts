import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { KnowledgeGapsService } from '../ai/knowledge-gaps/knowledge-gaps.service';
import { LearningAnalyticsService } from '../ai/learning-analytics/learning-analytics.service';

const WEIGHTS = {
  KNOWLEDGE_GAPS: 0.3,
  OVERDUE_TASKS: 0.25,
  CONFIDENCE: 0.2,
  ROADMAP_PROGRESS: 0.15,
  ENGAGEMENT: 0.1,
};

@Injectable()
export class RiskEngineService {
  private readonly logger = new Logger(RiskEngineService.name);

  constructor(
    private prisma: PrismaService,
    private knowledgeGapsService: KnowledgeGapsService,
    private learningAnalytics: LearningAnalyticsService,
  ) {}

  async calculateRisk(userId: number) {
    const [gaps, analytics, tasks, roadmaps] = await Promise.all([
      this.knowledgeGapsService.list(userId),
      this.learningAnalytics.getAnalytics(userId),
      this.prisma.task.findMany({
        where: { subject: { userId }, status: { not: 'COMPLETED' } },
        include: { subject: { select: { id: true, nombre: true } } },
      }),
      this.prisma.roadmap.findMany({
        where: { userId },
        include: { steps: true },
      }),
    ]);

    const activeGaps = (gaps || []).filter(
      (g: any) => g.status === 'DETECTED' || g.status === 'IMPROVING',
    );

    const now = new Date();
    const overdueTasks = tasks.filter((t) => t.dueDate < now);

    const gapScore = Math.min(1, activeGaps.length / 10);
    const overdueScore = Math.min(1, overdueTasks.length / 5);
    const confidenceScore =
      analytics?.masteryScore != null ? 1 - analytics.masteryScore : 0.5;
    const roadmapScore = this.calculateRoadmapRisk(roadmaps);
    const engagementScore =
      analytics?.engagementScore != null ? 1 - analytics.engagementScore : 0.5;

    const riskScore = Math.round(
      gapScore * WEIGHTS.KNOWLEDGE_GAPS * 100 +
        overdueScore * WEIGHTS.OVERDUE_TASKS * 100 +
        confidenceScore * WEIGHTS.CONFIDENCE * 100 +
        roadmapScore * WEIGHTS.ROADMAP_PROGRESS * 100 +
        engagementScore * WEIGHTS.ENGAGEMENT * 100,
    );

    const reasons: string[] = [];
    if (activeGaps.length > 0)
      reasons.push(`${activeGaps.length} gap(s) activo(s)`);
    if (overdueTasks.length > 0)
      reasons.push(`${overdueTasks.length} tarea(s) vencida(s)`);
    if (confidenceScore > 0.6) reasons.push('confianza baja en las materias');
    if (roadmapScore > 0.5) reasons.push('progreso bajo en roadmaps');
    if (engagementScore > 0.6) reasons.push('poca actividad reciente');

    const level = riskScore < 40 ? 'LOW' : riskScore < 70 ? 'MEDIUM' : 'HIGH';

    return {
      riskScore,
      level,
      reasons,
      gapScore,
      overdueScore,
      confidenceScore,
      roadmapScore,
      engagementScore,
    };
  }

  async calculateSubjectRisk(userId: number, subjectId: number) {
    const subject = await this.prisma.subject.findUnique({
      where: { id: subjectId },
      include: { tasks: true },
    });
    if (!subject || subject.userId !== userId) return null;

    const gaps = await this.knowledgeGapsService.listBySubject(
      userId,
      subject.nombre,
    );
    const activeGaps = (gaps || []).filter(
      (g: any) => g.status === 'DETECTED' || g.status === 'IMPROVING',
    );

    const now = new Date();
    const overdueTasks = subject.tasks.filter(
      (t) => t.dueDate < now && t.status !== 'COMPLETED',
    );
    const totalTasks = subject.tasks.filter((t) => t.status !== 'COMPLETED');

    const gapScore = Math.min(1, activeGaps.length / 5);
    const overdueScore = Math.min(1, overdueTasks.length / 3);
    const taskRatio =
      totalTasks.length > 0 ? overdueTasks.length / totalTasks.length : 0;
    const taskScore = overdueScore * 0.5 + taskRatio * 0.5;

    const riskScore = Math.round(gapScore * 40 + taskScore * 60);
    const level = riskScore < 40 ? 'LOW' : riskScore < 70 ? 'MEDIUM' : 'HIGH';

    const reasons: string[] = [];
    if (activeGaps.length > 0)
      reasons.push(`${activeGaps.length} gap(s) activo(s)`);
    if (overdueTasks.length > 0)
      reasons.push(`${overdueTasks.length} tarea(s) vencida(s)`);

    return {
      subjectId,
      subjectName: subject.nombre,
      riskScore,
      level,
      reasons,
      gapScore,
      taskScore,
    };
  }

  private calculateRoadmapRisk(roadmaps: any[]): number {
    if (roadmaps.length === 0) return 0.5;
    let totalProgress = 0;
    let count = 0;
    for (const r of roadmaps) {
      const steps = r.steps || [];
      if (steps.length > 0) {
        const completed = steps.filter((s: any) => s.completed).length;
        totalProgress += completed / steps.length;
        count++;
      }
    }
    const avgProgress = count > 0 ? totalProgress / count : 0;
    return 1 - avgProgress;
  }
}
