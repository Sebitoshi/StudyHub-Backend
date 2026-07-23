import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { CreateSessionDto } from './dto/create-session.dto';

@Injectable()
export class StudyGroupsService {
  private readonly logger = new Logger(StudyGroupsService.name);

  constructor(private prisma: PrismaService) {}

  async create(userId: number, dto: CreateGroupDto) {
    return this.prisma.studyGroup.create({
      data: {
        creatorId: userId,
        name: dto.name,
        description: dto.description,
        subjectId: dto.subjectId,
        subjectName: dto.subjectName,
        maxMembers: dto.maxMembers ?? 20,
        isPublic: dto.isPublic ?? true,
        password: dto.isPublic ? null : (dto.password ?? null),
      },
      include: {
        creator: {
          select: { id: true, nombre: true, apellido: true, email: true },
        },
        members: true,
      },
    });
  }

  async findAll(userId: number, page = 1, limit = 20, sortBy?: string, order?: string) {
    const skip = (page - 1) * limit;
    const [groups, total] = await Promise.all([
      this.prisma.studyGroup.findMany({
        where: { isPublic: true },
        skip,
        take: limit,
        orderBy: { [sortBy || 'createdAt']: (order === 'asc' ? 'asc' : 'desc') },
        include: {
          creator: { select: { id: true, nombre: true, apellido: true } },
          subject: { select: { id: true, nombre: true } },
          members: {
            include: {
              user: { select: { id: true, nombre: true, apellido: true } },
            },
          },
          _count: { select: { members: true, sessions: true } },
        },
      }),
      this.prisma.studyGroup.count({ where: { isPublic: true } }),
    ]);
    return { groups, total, page, limit };
  }

  async findOne(id: number, userId: number) {
    const group = await this.prisma.studyGroup.findUnique({
      where: { id },
      include: {
        creator: {
          select: { id: true, nombre: true, apellido: true, email: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, nombre: true, apellido: true, email: true },
            },
          },
        },
        sessions: { orderBy: { startAt: 'asc' } },
        _count: { select: { members: true } },
      },
    });
    if (!group) throw new NotFoundException('Grupo no encontrado');
    return group;
  }

  async join(groupId: number, userId: number, password?: string) {
    const group = await this.prisma.studyGroup.findUnique({
      where: { id: groupId },
      include: { _count: { select: { members: true } } },
    });
    if (!group) throw new NotFoundException('Grupo no encontrado');

    if (group._count.members >= group.maxMembers) {
      throw new BadRequestException(
        'El grupo ya alcanzó el máximo de miembros',
      );
    }

    // Validate password for private groups
    if (!group.isPublic && group.password) {
      if (!password || password !== group.password) {
        throw new BadRequestException('PIN incorrecto');
      }
    }

    const existing = await this.prisma.studyGroupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (existing)
      throw new BadRequestException('Ya eres miembro de este grupo');

    return this.prisma.studyGroupMember.create({
      data: { groupId, userId, role: 'MEMBER' },
      include: { user: { select: { id: true, nombre: true, apellido: true } } },
    });
  }

  async leave(groupId: number, userId: number) {
    const member = await this.prisma.studyGroupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!member) throw new NotFoundException('No eres miembro de este grupo');

    const group = await this.prisma.studyGroup.findUnique({
      where: { id: groupId },
    });
    if (group?.creatorId === userId) {
      throw new BadRequestException(
        'El creador no puede salirse del grupo. Transfiere la propiedad primero.',
      );
    }

    await this.prisma.studyGroupMember.delete({ where: { id: member.id } });
    return { ok: true };
  }

  async createSession(groupId: number, userId: number, dto: CreateSessionDto) {
    const group = await this.prisma.studyGroup.findUnique({
      where: { id: groupId },
    });
    if (!group) throw new NotFoundException('Grupo no encontrado');

    const member = await this.prisma.studyGroupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!member && group.creatorId !== userId) {
      throw new ForbiddenException('Solo miembros pueden crear sesiones');
    }

    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);
    if (endAt <= startAt) {
      throw new BadRequestException(
        'La fecha de fin debe ser posterior a la de inicio',
      );
    }

    return this.prisma.studyGroupSession.create({
      data: {
        groupId,
        title: dto.title,
        description: dto.description,
        startAt,
        endAt,
      },
    });
  }

  async getSessions(groupId: number) {
    const group = await this.prisma.studyGroup.findUnique({
      where: { id: groupId },
    });
    if (!group) throw new NotFoundException('Grupo no encontrado');

    return this.prisma.studyGroupSession.findMany({
      where: { groupId },
      orderBy: { startAt: 'asc' },
    });
  }

  async getMyGroups(userId: number) {
    return this.prisma.studyGroup.findMany({
      where: {
        OR: [{ creatorId: userId }, { members: { some: { userId } } }],
      },
      include: {
        creator: { select: { id: true, nombre: true, apellido: true } },
        subject: { select: { id: true, nombre: true } },
        members: {
          include: {
            user: { select: { id: true, nombre: true, apellido: true } },
          },
        },
        _count: { select: { members: true, sessions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
