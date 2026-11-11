import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GroupRecommendationService {
  private readonly logger = new Logger(GroupRecommendationService.name);

  constructor(
    private prisma: PrismaService,
  ) {}

  async getRecommendations(userId: number) {
    const [profile, myGroups] = await Promise.all([
      this.prisma.academicProfile.findUnique({ where: { userId } }),
      this.prisma.studyGroupMember.findMany({
        where: { userId },
        select: { groupId: true },
      }),
    ]);

    const myGroupIds = new Set(myGroups.map((m) => m.groupId));
    const groups = await this.prisma.studyGroup.findMany({
      where: {
        isPublic: true,
        id: { notIn: [...myGroupIds] },
        ...(profile?.carrera
          ? { subject: { user: { profile: { carrera: profile.carrera } } } }
          : {}),
      },
      include: {
        creator: { select: { id: true, nombre: true, apellido: true } },
        subject: { select: { id: true, nombre: true } },
        _count: { select: { members: true, sessions: true } },
      },
      take: 20,
    });

    const scored = groups.map((group) => {
      let score = 0;
      const reasons: string[] = [];

      const groupSubj = group.subject?.nombre?.toLowerCase() || '';

      if (group._count.members < group.maxMembers) {
        score += 10;
        reasons.push('Tiene cupos disponibles');
      }

      return { ...group, score, reasons: reasons.slice(0, 2) };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.filter((g) => g.score > 0).slice(0, 10);
  }
}
