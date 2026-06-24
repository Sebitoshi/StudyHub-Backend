import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { KnowledgeGapsService } from '../ai/knowledge-gaps/knowledge-gaps.service';
import { LearningGoalsService } from '../ai/learning-goals/learning-goals.service';

@Injectable()
export class GroupRecommendationService {
  constructor(
    private prisma: PrismaService,
    private knowledgeGapsService: KnowledgeGapsService,
    private learningGoalsService: LearningGoalsService,
  ) {}

  async getRecommendations(userId: number) {
    const [profile, gaps, goals, myGroups] = await Promise.all([
      this.prisma.academicProfile.findUnique({ where: { userId } }),
      this.knowledgeGapsService.list(userId),
      this.learningGoalsService.listGoals(userId),
      this.prisma.studyGroupMember.findMany({
        where: { userId },
        select: { groupId: true },
      }),
    ]);

    const myGroupIds = new Set(myGroups.map((m) => m.groupId));
    const activeGaps = (gaps || []).filter(
      (g: any) => g.status === 'DETECTED' || g.status === 'IMPROVING',
    );
    const gapSubjects = [
      ...new Set(activeGaps.map((g: any) => g.subject).filter(Boolean)),
    ];
    const goalTitles = (goals || [])
      .filter(Boolean)
      .map((g: any) => g.title.toLowerCase());

    const groups = await this.prisma.studyGroup.findMany({
      where: {
        isPublic: true,
        id: { notIn: [...myGroupIds] },
        OR: [
          ...(profile?.carrera
            ? [{ subject: { user: { profile: { carrera: profile.carrera } } } }]
            : []),
          ...(gapSubjects.length
            ? gapSubjects.map((s) => ({
                subject: {
                  nombre: { contains: s, mode: 'insensitive' as const },
                },
              }))
            : []),
        ].filter(Boolean) as any,
      },
      include: {
        creator: { select: { id: true, nombre: true, apellido: true } },
        subject: { select: { id: true, nombre: true } },
        _count: { select: { members: true } },
      },
      take: 20,
    });

    const scored = groups.map((group) => {
      let score = 0;
      const reasons: string[] = [];

      const groupSubj = group.subject?.nombre?.toLowerCase() || '';

      for (const gap of activeGaps) {
        if (gap.subject?.toLowerCase() === groupSubj) {
          score += 30;
          reasons.push(`Tienes dificultades en ${gap.subject}`);
          break;
        }
      }

      for (const title of goalTitles) {
        if (groupSubj && title.includes(groupSubj)) {
          score += 20;
          reasons.push(`Relacionado con tu meta: "${title.slice(0, 40)}"`);
          break;
        }
      }

      if (group._count.members < group.maxMembers) {
        score += 10;
      }

      return { ...group, score, reasons: reasons.slice(0, 2) };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.filter((g) => g.score > 0).slice(0, 10);
  }
}
