import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AcademicContextService {
  private readonly logger = new Logger(AcademicContextService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Build a rich academic context object for the given user.
   * This queries PostgreSQL via Prisma and returns a concise object.
   */
  async buildAcademicContext(userId: number) {
    // Load profile and related info
    const [profile, professional, subjects, progress, streak, skills, objectives, achievements] = await Promise.all([
      this.prisma.academicProfile.findUnique({ where: { userId } }),
      this.prisma.professionalProfile.findUnique({ where: { userId } }),
      this.prisma.subject.findMany({ where: { userId }, include: { tasks: true, notes: true, schedules: true } }),
      this.prisma.userProgress.findUnique({ where: { userId } }),
      this.prisma.studyStreak.findUnique({ where: { userId } }),
      this.prisma.userSkill.findMany({ where: { userId }, include: { skill: true } }),
      this.prisma.userObjective.findMany({ where: { userId }, include: { objective: true } }),
      this.prisma.userAchievement.findMany({ where: { userId }, include: { achievement: true } }),
    ]);

    const subjectsSummary = subjects.map((s) => ({
      id: s.id,
      name: s.nombre,
      professor: s.profesor,
      tasksPending: s.tasks.filter((t) => t.status === 'PENDING').map((t) => ({ id: t.id, title: t.title, dueDate: t.dueDate })),
      notesCount: s.notes.length,
      schedules: s.schedules.map((sc) => ({ dayOfWeek: sc.dayOfWeek, startTime: sc.startTime, endTime: sc.endTime, classroom: sc.classroom })),
    }));

    const pendingTasks = subjects.flatMap((s) => s.tasks).filter((t) => t.status === 'PENDING').slice(0, 20).map((t) => ({ id: t.id, title: t.title, dueDate: t.dueDate, subjectId: t.subjectId }));

    const recentNotes = subjects.flatMap((s) => s.notes).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 10).map((n) => ({ id: n.id, title: n.title, subjectId: n.subjectId, snippet: n.content?.slice(0, 300) }));

    const skillsList = skills.map((us) => ({ id: us.skillId, name: us.skill?.nombre, level: us.nivel }));

    const objectivesList = objectives.map((o) => ({ id: o.objectiveId, name: o.objective?.nombre }));

    const achievementsList = achievements.map((a) => ({ id: a.achievementId, code: a.achievement?.code, name: a.achievement?.nombre }));

    const context = {
      career: profile?.carrera ?? null,
      university: profile?.universidad ?? null,
      semester: profile?.semestreActual ?? null,
      modality: profile?.modalidad ?? null,
      professionalGoal: professional?.cargoDeseado ?? null,
      subjects: subjectsSummary,
      pendingTasks,
      recentNotes,
      schedules: subjectsSummary.flatMap((s) => s.schedules).slice(0, 20),
      level: progress?.level ?? null,
      xp: progress?.xp ?? null,
      currentStreak: streak?.currentStreak ?? 0,
      bestStreak: streak?.bestStreak ?? 0,
      skills: skillsList,
      objectives: objectivesList,
      achievements: achievementsList,
    };

    // Optionally log size
    this.logger.log(`Built academic context for user ${userId}: subjects=${subjects.length} pendingTasks=${pendingTasks.length}`);
    return context;
  }
}
