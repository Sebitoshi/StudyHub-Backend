import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAcademicProfileDto } from './dto/create-academic-profile.dto';
import { UpdateAcademicProfileDto } from './dto/update-academic-profile.dto';
import { CreateProfessionalProfileDto } from './dto/create-professional-profile.dto';
import { UpdateProfessionalProfileDto } from './dto/update-professional-profile.dto';
import { AddSkillDto } from './dto/add-skill.dto';
import { AddObjectiveDto } from './dto/add-objective.dto';
import { ToggleModuleDto } from './dto/toggle-module.dto';
import { UpdatePersonalInfoDto } from './dto/update-personal-info.dto';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';
import { UpdatePrivacySettingsDto } from './dto/update-privacy-settings.dto';
import { GamificationService } from '../gamification/gamification.service';
import { XpActionType } from '../common/enums';

@Injectable()
export class ProfileService {
  constructor(
    private prisma: PrismaService,
    private gamification: GamificationService,
  ) {}

  // ─── Academic ───────────────────────────────────────────

  async createAcademic(userId: number, dto: CreateAcademicProfileDto) {
    const existing = await this.prisma.academicProfile.findUnique({
      where: { userId },
    });

    if (existing) {
      throw new ConflictException('Ya tienes un perfil académico');
    }

    return this.prisma.academicProfile.create({
      data: {
        userId,
        universidad: dto.universidad,
        carrera: dto.carrera,
        facultad: dto.facultad,
        semestreActual: dto.semestreActual,
        fechaInicio: new Date(dto.fechaInicio),
        fechaGraduacion: new Date(dto.fechaGraduacion),
        modalidad: dto.modalidad,
        promedio: dto.promedio,
        materiasFav: dto.materiasFav ?? [],
        materiasDificil: dto.materiasDificil ?? [],
      },
    });
  }

  async findAcademicByUser(userId: number) {
    const profile = await this.prisma.academicProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Perfil académico no encontrado');
    }

    return profile;
  }

  async updateAcademic(userId: number, dto: UpdateAcademicProfileDto) {
    const existing = await this.prisma.academicProfile.findUnique({
      where: { userId },
    });

    if (!existing) {
      throw new NotFoundException('Perfil académico no encontrado');
    }

    return this.prisma.academicProfile.update({
      where: { userId },
      data: {
        ...dto,
        fechaInicio: dto.fechaInicio
          ? new Date(dto.fechaInicio)
          : undefined,
        fechaGraduacion: dto.fechaGraduacion
          ? new Date(dto.fechaGraduacion)
          : undefined,
      },
    });
  }

  async removeAcademic(userId: number) {
    const existing = await this.prisma.academicProfile.findUnique({
      where: { userId },
    });

    if (!existing) {
      throw new NotFoundException('Perfil académico no encontrado');
    }

    return this.prisma.academicProfile.delete({ where: { userId } });
  }

  // ─── Professional ────────────────────────────────────────

  async createProfessional(userId: number, dto: CreateProfessionalProfileDto) {
    const existing = await this.prisma.professionalProfile.findUnique({
      where: { userId },
    });

    if (existing) {
      throw new ConflictException('Ya tienes un perfil profesional');
    }

    return this.prisma.professionalProfile.create({ data: { userId, ...dto } });
  }

  async findProfessionalByUser(userId: number) {
    const profile = await this.prisma.professionalProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Perfil profesional no encontrado');
    }

    return profile;
  }

  async updateProfessional(userId: number, dto: UpdateProfessionalProfileDto) {
    const existing = await this.prisma.professionalProfile.findUnique({
      where: { userId },
    });

    if (!existing) {
      throw new NotFoundException('Perfil profesional no encontrado');
    }

    return this.prisma.professionalProfile.update({
      where: { userId },
      data: dto,
    });
  }

  async removeProfessional(userId: number) {
    const existing = await this.prisma.professionalProfile.findUnique({
      where: { userId },
    });

    if (!existing) {
      throw new NotFoundException('Perfil profesional no encontrado');
    }

    return this.prisma.professionalProfile.delete({ where: { userId } });
  }

  // ─── Skills ─────────────────────────────────────────────

  async findAllSkills() {
    return this.prisma.skill.findMany({ orderBy: { nombre: 'asc' } });
  }

  async createSkill(nombre: string) {
    const existing = await this.prisma.skill.findUnique({ where: { nombre } });

    if (existing) {
      throw new ConflictException('La habilidad ya existe');
    }

    return this.prisma.skill.create({ data: { nombre } });
  }

  async getUserSkills(userId: number) {
    return this.prisma.userSkill.findMany({
      where: { userId },
      include: { skill: true },
    });
  }

  async addSkillToUser(userId: number, dto: AddSkillDto) {
    const skill = await this.prisma.skill.findUnique({
      where: { id: dto.skillId },
    });

    if (!skill) {
      throw new NotFoundException('Habilidad no encontrada');
    }

    const existing = await this.prisma.userSkill.findUnique({
      where: { userId_skillId: { userId, skillId: dto.skillId } },
    });

    if (existing) {
      throw new ConflictException('Ya tienes esta habilidad');
    }

    return this.prisma.userSkill.create({
      data: { userId, skillId: dto.skillId, nivel: dto.nivel },
      include: { skill: true },
    });
  }

  async updateUserSkill(userId: number, dto: AddSkillDto) {
    const existing = await this.prisma.userSkill.findUnique({
      where: { userId_skillId: { userId, skillId: dto.skillId } },
    });

    if (!existing) {
      throw new NotFoundException('No tienes esta habilidad asignada');
    }

    return this.prisma.userSkill.update({
      where: { userId_skillId: { userId, skillId: dto.skillId } },
      data: { nivel: dto.nivel },
      include: { skill: true },
    });
  }

  async removeSkillFromUser(userId: number, skillId: number) {
    const existing = await this.prisma.userSkill.findUnique({
      where: { userId_skillId: { userId, skillId } },
    });

    if (!existing) {
      throw new NotFoundException('No tienes esta habilidad asignada');
    }

    await this.prisma.userSkill.delete({
      where: { userId_skillId: { userId, skillId } },
    });
  }

  // ─── Objectives ─────────────────────────────────────────

  async findAllObjectives() {
    return this.prisma.objective.findMany({ orderBy: { nombre: 'asc' } });
  }

  async getUserObjectives(userId: number) {
    return this.prisma.userObjective.findMany({
      where: { userId },
      include: { objective: true },
    });
  }

  async addObjectiveToUser(userId: number, dto: AddObjectiveDto) {
    const objective = await this.prisma.objective.findUnique({
      where: { id: dto.objectiveId },
    });

    if (!objective) {
      throw new NotFoundException('Objetivo no encontrado');
    }

    const existing = await this.prisma.userObjective.findUnique({
      where: {
        userId_objectiveId: { userId, objectiveId: dto.objectiveId },
      },
    });

    if (existing) {
      throw new ConflictException('Ya tienes este objetivo');
    }

    return this.prisma.userObjective.create({
      data: { userId, objectiveId: dto.objectiveId },
      include: { objective: true },
    });
  }

  async removeObjectiveFromUser(userId: number, objectiveId: number) {
    const existing = await this.prisma.userObjective.findUnique({
      where: { userId_objectiveId: { userId, objectiveId } },
    });

    if (!existing) {
      throw new NotFoundException('No tienes este objetivo');
    }

    await this.prisma.userObjective.delete({
      where: { userId_objectiveId: { userId, objectiveId } },
    });
  }

  // ─── Modules ────────────────────────────────────────────

  async findAllModules() {
    return this.prisma.appModule.findMany({ orderBy: { nombre: 'asc' } });
  }

  async getUserModules(userId: number) {
    return this.prisma.userModule.findMany({
      where: { userId },
      include: { module: true },
    });
  }

  async toggleModule(userId: number, dto: ToggleModuleDto) {
    const appModule = await this.prisma.appModule.findUnique({
      where: { id: dto.moduleId },
    });

    if (!appModule) {
      throw new NotFoundException('Módulo no encontrado');
    }

    const existing = await this.prisma.userModule.findUnique({
      where: { userId_moduleId: { userId, moduleId: dto.moduleId } },
    });

    if (existing) {
      await this.prisma.userModule.delete({
        where: { userId_moduleId: { userId, moduleId: dto.moduleId } },
      });
      return { activo: false, module: appModule };
    }

    await this.prisma.userModule.create({
      data: { userId, moduleId: dto.moduleId },
    });
    return { activo: true, module: appModule };
  }

  async activateDefaultModules(userId: number) {
    const defaults = await this.prisma.appModule.findMany({
      where: { activoDefecto: true },
    });

    await this.prisma.userModule.createMany({
      data: defaults.map((m) => ({ userId, moduleId: m.id })),
      skipDuplicates: true,
    });

    return this.getUserModules(userId);
  }

  // ─── Personal Info ─────────────────────────────────────

  async getPersonalInfo(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        progress: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const { password, twoFactorSecret, ...safeUser } = user;
    return safeUser;
  }

  async updatePersonalInfo(userId: number, dto: UpdatePersonalInfoDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...dto,
        fechaNacimiento: dto.fechaNacimiento
          ? new Date(dto.fechaNacimiento)
          : undefined,
      },
    });

    if (dto.biografia || dto.github || dto.linkedin || dto.portafolio) {
      await this.gamification.addXp(userId, 10, XpActionType.COMPLETE_PROFILE);
    }

    const { password, twoFactorSecret, ...safeUser } = updated;
    return safeUser;
  }

  // ─── Notifications ──────────────────────────────────

  async getNotificationSettings(userId: number) {
    let settings = await this.prisma.notificationSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      settings = await this.prisma.notificationSettings.create({
        data: { userId },
      });
    }

    return settings;
  }

  async updateNotificationSettings(
    userId: number,
    dto: UpdateNotificationSettingsDto,
  ) {
    const existing = await this.prisma.notificationSettings.findUnique({
      where: { userId },
    });

    if (!existing) {
      await this.prisma.notificationSettings.create({
        data: { userId, ...dto },
      });
    } else {
      await this.prisma.notificationSettings.update({
        where: { userId },
        data: dto,
      });
    }

    return this.getNotificationSettings(userId);
  }

  // ─── Privacy ───────────────────────────────────────

  async getPrivacySettings(userId: number) {
    let settings = await this.prisma.privacySettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      settings = await this.prisma.privacySettings.create({
        data: { userId },
      });
    }

    return settings;
  }

  async updatePrivacySettings(userId: number, dto: UpdatePrivacySettingsDto) {
    const existing = await this.prisma.privacySettings.findUnique({
      where: { userId },
    });

    if (!existing) {
      await this.prisma.privacySettings.create({
        data: { userId, ...dto },
      });
    } else {
      await this.prisma.privacySettings.update({
        where: { userId },
        data: dto,
      });
    }

    return this.getPrivacySettings(userId);
  }

  // ─── Security ──────────────────────────────────────

  async generate2faSecret(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (user.twoFactorEnabled) {
      throw new BadRequestException('2FA ya está habilitado');
    }

    const secret = 'TODO-generate-with-speakeasy'; // placeholder
    return { secret };
  }

  async verifyAndEnable2fa(userId: number, token: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (!user.twoFactorSecret) {
      throw new BadRequestException(
        'Primero genera un secreto para 2FA',
      );
    }

    // TODO: verify with speakeasy
    const isValid = token.length > 0;

    if (!isValid) {
      throw new BadRequestException('Código 2FA inválido');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true },
    });

    return { message: '2FA habilitado correctamente' };
  }

  async disable2fa(userId: number) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });

    return { message: '2FA deshabilitado correctamente' };
  }

  async getActiveSessions(userId: number) {
    return this.prisma.userSession.findMany({
      where: { userId },
      orderBy: { lastActiveAt: 'desc' },
    });
  }

  async revokeSession(userId: number, sessionId: number) {
    const session = await this.prisma.userSession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new NotFoundException('Sesión no encontrada');
    }

    await this.prisma.userSession.delete({
      where: { id: sessionId },
    });

    return { message: 'Sesión revocada' };
  }

  async getAccessLogs(userId: number) {
    return this.prisma.userAccessLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
