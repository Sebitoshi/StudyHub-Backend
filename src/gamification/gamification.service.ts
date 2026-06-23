import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const XP_VALUES = {
  CREATE_SUBJECT: 10,
  CREATE_TASK: 15,
  COMPLETE_TASK: 25,
  CREATE_NOTE: 10,
  DAILY_STREAK: 20,
} as const;

const LEVEL_THRESHOLDS = [0, 100, 250, 500, 800, 1200, 1700, 2300, 3000, 4000];

function calculateLevel(totalXp: number): number {
  let level = 1;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (totalXp >= LEVEL_THRESHOLDS[i]) {
      level = i + 1;
      break;
    }
  }
  return level;
}

function xpForNextLevel(level: number): number {
  const idx = Math.min(level, LEVEL_THRESHOLDS.length - 1);
  return LEVEL_THRESHOLDS[idx];
}

@Injectable()
export class GamificationService {
  constructor(private prisma: PrismaService) {}

  async getProgress(userId: number) {
    let progress = await this.prisma.userProgress.findUnique({
      where: { userId },
    });

    if (!progress) {
      progress = await this.prisma.userProgress.create({
        data: { userId },
      });
    }

    const streak = await this.prisma.studyStreak.findUnique({
      where: { userId },
    });

    const achievements = await this.prisma.userAchievement.findMany({
      where: { userId },
      include: { achievement: true },
      orderBy: { unlockedAt: 'desc' },
    });

    return {
      level: progress.level,
      xp: progress.xp,
      totalXp: progress.totalXp,
      xpForNextLevel: xpForNextLevel(progress.level),
      streak: streak?.currentStreak ?? 0,
      bestStreak: streak?.bestStreak ?? 0,
      achievements: achievements.length,
      achievementsList: achievements.map((ua) => ({
        id: ua.achievement.id,
        nombre: ua.achievement.nombre,
        descripcion: ua.achievement.descripcion,
        icon: ua.achievement.icon,
        unlockedAt: ua.unlockedAt,
      })),
    };
  }

  async addXp(userId: number, amount: number, action: string) {
    const progress = await this.prisma.userProgress.upsert({
      where: { userId },
      create: { userId, xp: amount, totalXp: amount },
      update: {
        xp: { increment: amount },
        totalXp: { increment: amount },
      },
    });

    const newLevel = calculateLevel(progress.totalXp + amount);

    if (newLevel > progress.level) {
      await this.prisma.userProgress.update({
        where: { userId },
        data: { level: newLevel },
      });
    }

    await this.updateStreak(userId);

    await this.checkAchievements(userId);

    return this.getProgress(userId);
  }

  private async updateStreak(userId: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let streak = await this.prisma.studyStreak.findUnique({
      where: { userId },
    });

    if (!streak) {
      streak = await this.prisma.studyStreak.create({
        data: { userId, currentStreak: 1, bestStreak: 1, lastActivityAt: today },
      });
      return streak;
    }

    const lastActive = streak.lastActivityAt
      ? new Date(streak.lastActivityAt)
      : null;

    if (lastActive) {
      lastActive.setHours(0, 0, 0, 0);
      const diffDays = Math.round(
        (today.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (diffDays === 1) {
        const newStreak = streak.currentStreak + 1;
        streak = await this.prisma.studyStreak.update({
          where: { userId },
          data: {
            currentStreak: newStreak,
            bestStreak: Math.max(streak.bestStreak, newStreak),
            lastActivityAt: today,
          },
        });
      } else if (diffDays > 1) {
        streak = await this.prisma.studyStreak.update({
          where: { userId },
          data: {
            currentStreak: 1,
            lastActivityAt: today,
          },
        });
      }
    } else {
      streak = await this.prisma.studyStreak.update({
        where: { userId },
        data: { currentStreak: 1, lastActivityAt: today },
      });
    }

    return streak;
  }

  private async checkAchievements(userId: number) {
    const progress = await this.prisma.userProgress.findUnique({
      where: { userId },
    });
    if (!progress) return;

    const allAchievements = await this.prisma.achievement.findMany();
    const userAchievements = await this.prisma.userAchievement.findMany({
      where: { userId },
    });
    const unlockedIds = new Set(
      userAchievements.map((ua) => ua.achievementId),
    );

    const taskCount = await this.prisma.task.count({
      where: { subject: { userId } },
    });
    const completedTasks = await this.prisma.task.count({
      where: { subject: { userId }, status: 'COMPLETED' },
    });
    const noteCount = await this.prisma.note.count({
      where: { subject: { userId } },
    });
    const subjectCount = await this.prisma.subject.count({ where: { userId } });
    const streak = await this.prisma.studyStreak.findUnique({
      where: { userId },
    });

    const conditions: Record<string, boolean> = {
      FIRST_SUBJECT: subjectCount >= 1,
      FIRST_TASK: taskCount >= 1,
      FIRST_TASK_COMPLETED: completedTasks >= 1,
      TEN_TASKS_COMPLETED: completedTasks >= 10,
      FIFTY_TASKS_COMPLETED: completedTasks >= 50,
      HUNDRED_NOTES: noteCount >= 100,
      STREAK_7: (streak?.bestStreak ?? 0) >= 7,
      STREAK_30: (streak?.bestStreak ?? 0) >= 30,
      LEVEL_5: progress.level >= 5,
    };

    for (const achievement of allAchievements) {
      if (unlockedIds.has(achievement.id)) continue;
      if (conditions[achievement.nombre]) {
        await this.prisma.userAchievement.create({
          data: { userId, achievementId: achievement.id },
        });
        if (achievement.xpReward > 0) {
          await this.prisma.userProgress.update({
            where: { userId },
            data: {
              xp: { increment: achievement.xpReward },
              totalXp: { increment: achievement.xpReward },
            },
          });
        }
      }
    }
  }
}
