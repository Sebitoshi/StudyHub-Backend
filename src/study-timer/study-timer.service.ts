import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStudySessionDto } from './dto/create-study-session.dto';
import { XpActionType } from '@prisma/client';
import { calculateLevel } from '../gamification/gamification.service';

@Injectable()
export class StudyTimerService {
  private readonly logger = new Logger(StudyTimerService.name);

  constructor(private prisma: PrismaService) {}

  async saveSession(userId: number, dto: CreateStudySessionDto) {
    // 1. Calculate XP based on duration and technique
    let xpEarned = 0;
    if (dto.technique === 'POMODORO_25_5') {
      xpEarned = 10;
    } else if (dto.technique === 'POMODORO_50_10') {
      xpEarned = 25;
    } else if (dto.technique === 'DEEP_BLOCK_90') {
      xpEarned = 50;
    } else {
      // Fallback
      xpEarned = Math.floor(dto.durationMinutes / 2.5); // Roughly 10 XP per 25 min
    }

    // 2. Save the session
    const session = await this.prisma.studyTimerSession.create({
      data: {
        userId,
        subjectId: dto.subjectId || null,
        durationMinutes: dto.durationMinutes,
        technique: dto.technique,
        xpEarned,
      },
    });

    // 3. Update User XP
    await this.prisma.$transaction(async (tx) => {
      // Create XP History
      await tx.xpHistory.create({
        data: {
          userId,
          amount: xpEarned,
          action: XpActionType.STUDY_SESSION,
          metadata: { technique: dto.technique, durationMinutes: dto.durationMinutes },
        },
      });

      // Update User Progress
      const progress = await tx.userProgress.findUnique({ where: { userId } });
      if (progress) {
        const newXp = progress.xp + xpEarned;
        const newTotalXp = progress.totalXp + xpEarned;
        // Misma fórmula de niveles que GamificationService (LEVEL_THRESHOLDS)
        const newLevel = calculateLevel(newTotalXp);

        await tx.userProgress.update({
          where: { userId },
          data: {
            xp: newXp % 100, // XP towards next level
            totalXp: newTotalXp,
            level: newLevel,
          },
        });
      } else {
        await tx.userProgress.create({
          data: {
            userId,
            xp: xpEarned,
            totalXp: xpEarned,
            level: 1,
          },
        });
      }
    });

    return { success: true, session, xpEarned };
  }

  async getStats(userId: number) {
    // Get total hours this week
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
    startOfWeek.setHours(0, 0, 0, 0);

    const result = await this.prisma.studyTimerSession.aggregate({
      where: {
        userId,
        completedAt: {
          gte: startOfWeek,
        },
      },
      _sum: {
        durationMinutes: true,
      },
    });

    const totalMinutes = result._sum.durationMinutes || 0;
    const totalHours = (totalMinutes / 60).toFixed(1);

    return { totalHours };
  }

  async getSessions(userId: number) {
    // Sesiones más recientes primero (historial del usuario)
    return this.prisma.studyTimerSession.findMany({
      where: { userId },
      orderBy: { completedAt: 'desc' },
      take: 100,
      select: {
        id: true,
        completedAt: true,
        durationMinutes: true,
        technique: true,
        xpEarned: true,
        subjectId: true,
      },
    });
  }

  async clearSessions(userId: number) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Sumar el XP de las sesiones que se van a eliminar
      const sessions = await tx.studyTimerSession.findMany({
        where: { userId },
        select: { xpEarned: true },
      });
      const totalXpToRevert = sessions.reduce((sum, s) => sum + s.xpEarned, 0);

      // 2. Eliminar las sesiones y su historial de XP (ledger)
      await tx.studyTimerSession.deleteMany({ where: { userId } });
      await tx.xpHistory.deleteMany({
        where: { userId, action: XpActionType.STUDY_SESSION },
      });

      // 3. Revertir el XP en user_progress (totalXp, xp y nivel)
      if (totalXpToRevert > 0) {
        const progress = await tx.userProgress.findUnique({ where: { userId } });
        if (progress) {
          const newTotalXp = Math.max(0, progress.totalXp - totalXpToRevert);
          await tx.userProgress.update({
            where: { userId },
            data: {
              totalXp: newTotalXp,
              xp: newTotalXp % 100,
              level: calculateLevel(newTotalXp),
            },
          });
        }
      }

      return { success: true, xpReverted: totalXpToRevert };
    });
  }
}
