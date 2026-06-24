import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class NotificationSchedulerService {
  private readonly logger = new Logger(NotificationSchedulerService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async checkTaskReminders() {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const tasks = await this.prisma.task.findMany({
      where: {
        status: { not: 'COMPLETED' },
        dueDate: { gte: now, lte: in24h },
      },
      include: { subject: { select: { userId: true, nombre: true } } },
    });

    for (const task of tasks) {
      await this.notifications.create(
        task.subject.userId,
        'Tarea próxima a vencer',
        `"${task.title}" de ${task.subject.nombre} vence en menos de 24h`,
        NotificationType.TASK_DUE,
        { taskId: task.id, subjectName: task.subject.nombre },
      );
    }

    this.logger.log(`TaskReminder: ${tasks.length} notificaciones`);
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async checkClassReminders() {
    const now = new Date();
    const later = new Date(now.getTime() + 30 * 60 * 1000);

    const currentDay = now.getDay();
    const currentTime = now.toTimeString().slice(0, 5);
    const laterTime = later.toTimeString().slice(0, 5);

    const schedules = await this.prisma.schedule.findMany({
      where: { dayOfWeek: currentDay },
      include: {
        subject: { select: { userId: true, nombre: true, profesor: true } },
      },
    });

    for (const sched of schedules) {
      if (sched.startTime >= currentTime && sched.startTime <= laterTime) {
        await this.notifications.create(
          sched.subject.userId,
          'Clase próxima a iniciar',
          `${sched.subject.nombre} con ${sched.subject.profesor || 'profesor asignado'} en ${sched.classroom || 'salón por definir'} a las ${sched.startTime}`,
          NotificationType.CLASS_REMINDER,
          { scheduleId: sched.id, subjectName: sched.subject.nombre },
        );
      }
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async checkRoadmapReminders() {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const roadmaps = await this.prisma.roadmap.findMany({
      where: { createdAt: { lte: sevenDaysAgo } },
      include: {
        steps: { where: { completed: false }, take: 1 },
      },
    });

    for (const r of roadmaps) {
      if (r.steps.length > 0) {
        const user = await this.prisma.roadmap.findUnique({
          where: { id: r.id },
          select: { userId: true },
        });
        if (!user) continue;

        await this.notifications.create(
          user.userId,
          'Roadmap sin progreso',
          `Tu roadmap "${r.title}" no ha tenido avances en más de 7 días. Revisa tus pasos pendientes.`,
          NotificationType.ROADMAP_REMINDER,
          { roadmapId: r.id },
        );
      }
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async checkGroupSessionReminders() {
    const now = new Date();
    const in1h = new Date(now.getTime() + 60 * 60 * 1000);

    const sessions = await this.prisma.studyGroupSession.findMany({
      where: { startAt: { gte: now, lte: in1h } },
      include: {
        group: {
          include: {
            members: { include: { user: { select: { id: true } } } },
            creator: { select: { id: true } },
          },
        },
      },
    });

    for (const session of sessions) {
      const userIds = new Set([
        session.group.creatorId,
        ...session.group.members.map((m) => m.userId),
      ]);

      for (const uid of userIds) {
        await this.notifications.create(
          uid,
          'Sesión de estudio próxima',
          `"${session.title}" del grupo "${session.group.name}" comienza en 1 hora`,
          NotificationType.GROUP_SESSION,
          { sessionId: session.id, groupName: session.group.name },
        );
      }
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async checkStreakReminders() {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const streaks = await this.prisma.studyStreak.findMany({
      where: {
        currentStreak: { gt: 0 },
        OR: [{ lastActivityAt: null }, { lastActivityAt: { lt: yesterday } }],
      },
    });

    for (const s of streaks) {
      await this.notifications.create(
        s.userId,
        'Racha en riesgo',
        `Llevas ${s.currentStreak} día(s) de racha. ¡Estudia hoy para no perderla!`,
        NotificationType.STREAK_RISK,
        { currentStreak: s.currentStreak, bestStreak: s.bestStreak },
      );
    }
  }
}
