import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GamificationService } from '../gamification/gamification.service';
import { AcademicRiskService } from '../academic-risk/academic-risk.service';
import { LearningGoalsService } from '../ai/learning-goals/learning-goals.service';
import { TaskStatus } from '../common/enums';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private prisma: PrismaService,
    private gamification: GamificationService,
    private academicRisk: AcademicRiskService,
    private learningGoals: LearningGoalsService,
  ) {}

  async getSummary(userId: number) {
    this.logger.log(`Fetching dashboard summary for user ${userId}`);
    const now = new Date();

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { nombre: true, apellido: true },
    });

    const [subjects, tasks, notes, gamification, risk, goals] = await Promise.all([
      this.prisma.subject.findMany({
        where: { userId },
        include: { schedules: true },
      }),
      this.prisma.task.findMany({
        where: { subject: { userId } },
        orderBy: { dueDate: 'asc' },
      }),
      this.prisma.note.findMany({
        where: { subject: { userId } },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      }),
      this.gamification.getProgress(userId),
      this.academicRisk.getLatest(userId),
      this.learningGoals.listGoals(userId),
    ]);

    const pendingTasks = tasks.filter(
      (t) => t.status !== TaskStatus.COMPLETED,
    );
    const completedTasks = tasks.filter(
      (t) => t.status === TaskStatus.COMPLETED,
    );

    const nowDay = now.getDay();
    const currentTime = now.toTimeString().slice(0, 5);
    const upcomingClasses = subjects
      .flatMap((s) =>
        s.schedules
          .filter((sch) => {
            if (sch.dayOfWeek !== nowDay) return false;
            return sch.startTime >= currentTime;
          })
          .map((sch) => ({
            subjectId: s.id,
            subject: s.nombre,
            profesor: s.profesor,
            startTime: sch.startTime,
            endTime: sch.endTime,
            classroom: sch.classroom,
            color: s.color,
          })),
      )
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .slice(0, 5);

    const upcomingTasks = pendingTasks
      .slice(0, 5)
      .map((t) => ({
        id: t.id,
        title: t.title,
        dueDate: t.dueDate,
        priority: t.priority,
        subjectId: t.subjectId,
        subject: subjects.find((s) => s.id === t.subjectId)?.nombre ?? null,
        subjectColor: subjects.find((s) => s.id === t.subjectId)?.color ?? null,
      }));

    const totalTasks = tasks.length;
    const completionRate =
      totalTasks > 0
        ? Math.round((completedTasks.length / totalTasks) * 100)
        : 0;

    const recentNotes = notes.map((n) => ({
      id: n.id,
      title: n.title,
      content: n.content,
      isPinned: n.isPinned,
      updatedAt: n.updatedAt,
      subject: subjects.find((s) => s.id === n.subjectId)?.nombre ?? null,
      subjectColor: subjects.find((s) => s.id === n.subjectId)?.color ?? null,
    }));

    const allGoals = (goals ?? []).filter((g): g is NonNullable<typeof g> => g != null);
    const activeGoals = allGoals
      .filter((g) => g.status === 'active')
      .slice(0, 3);

    return {
      user,
      stats: {
        subjects: subjects.length,
        pendingTasks: pendingTasks.length,
        completedTasks: completedTasks.length,
        notes: notes.length,
      },
      gamification: {
        level: gamification.level,
        xp: gamification.xp,
        totalXp: gamification.totalXp,
        xpForNextLevel: gamification.xpForNextLevel,
        streak: gamification.streak,
        achievements: gamification.achievements,
      },
      academicRisk: risk
        ? {
            id: risk.id,
            score: risk.score,
            level: risk.level,
            reasons: risk.reasons,
            createdAt: risk.createdAt,
          }
        : null,
      activeGoals,
      upcomingClasses,
      upcomingTasks,
      recentNotes,
      completionRate,
    };
  }
}
