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

  /**
   * Ranking global: usuarios con más racha y con más horas de estudio.
   */
  async getLeaderboard(userId: number) {
    const limit = 10;

    // ── Top racha (currentStreak) ──
    const streaks = await this.prisma.studyStreak.findMany({
      where: { currentStreak: { gt: 0 } },
      orderBy: [{ currentStreak: 'desc' }, { bestStreak: 'desc' }, { userId: 'asc' }],
      take: limit,
      select: {
        userId: true,
        currentStreak: true,
        bestStreak: true,
        user: {
          select: { nombre: true, apellido: true, foto: true },
        },
      },
    });

    // ── Top horas de estudio (suma de minutos de todas las sesiones) ──
    const hoursAgg = await this.prisma.studyTimerSession.groupBy({
      by: ['userId'],
      _sum: { durationMinutes: true },
      orderBy: [{ _sum: { durationMinutes: 'desc' } }, { userId: 'asc' }],
      take: limit,
    });

    const hourUserIds = hoursAgg.map((h) => h.userId);
    const hourUsers =
      hourUserIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: hourUserIds } },
            select: { id: true, nombre: true, apellido: true, foto: true },
          })
        : [];

    const hoursById = new Map(hourUsers.map((u) => [u.id, u]));

    const byHours = hoursAgg
      .map((h) => {
        const u = hoursById.get(h.userId);
        if (!u) return null;
        return {
          userId: u.id,
          nombre: u.nombre,
          apellido: u.apellido,
          foto: u.foto,
          totalMinutes: h._sum.durationMinutes ?? 0,
        };
      })
      .filter((e): e is NonNullable<typeof e> => e != null);

    // ── Posición GLOBAL del usuario actual (aunque no esté en el top) ──
    const myStreak = streaks.find((s) => s.userId === userId);
    const rankByStreak = myStreak
      ? (await this.prisma.studyStreak.count({
          where: { currentStreak: { gt: myStreak.currentStreak } },
        })) + 1
      : null;

    const myMinutes =
      hoursAgg.find((h) => h.userId === userId)?._sum.durationMinutes ?? 0;
    const rankByHours =
      myMinutes > 0
        ? (await this.prisma.studyTimerSession.groupBy({
            by: ['userId'],
            _sum: { durationMinutes: true },
            having: { durationMinutes: { _sum: { gt: myMinutes } } },
          })).length + 1
        : null;

    return {
      byStreak: streaks.map((s) => ({
        userId: s.userId,
        nombre: s.user.nombre,
        apellido: s.user.apellido,
        foto: s.user.foto,
        currentStreak: s.currentStreak,
        bestStreak: s.bestStreak,
      })),
      byHours,
      me: {
        rankByStreak,
        rankByHours,
      },
    };
  }
}
