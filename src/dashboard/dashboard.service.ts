import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GamificationService } from '../gamification/gamification.service';
import { TaskStatus } from '../common/enums';

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private gamification: GamificationService,
  ) {}

  async getSummary(userId: number) {
    const now = new Date();

    const [subjects, tasks, notes, gamification] = await Promise.all([
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
            subject: s.nombre,
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
        subject: subjects.find((s) => s.id === t.subjectId)?.nombre ?? null,
      }));

    const totalTasks = tasks.length;
    const completionRate =
      totalTasks > 0
        ? Math.round((completedTasks.length / totalTasks) * 100)
        : 0;

    const recentNotes = notes.map((n) => ({
      id: n.id,
      title: n.title,
      isPinned: n.isPinned,
      updatedAt: n.updatedAt,
      subject: subjects.find((s) => s.id === n.subjectId)?.nombre ?? null,
    }));

    return {
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
      upcomingClasses,
      upcomingTasks,
      recentNotes,
      completionRate,
    };
  }
}
