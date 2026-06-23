import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GamificationService } from '../gamification/gamification.service';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { TaskStatus, XpActionType } from '../common/enums';

@Injectable()
export class SubjectsService {
  constructor(
    private prisma: PrismaService,
    private gamification: GamificationService,
  ) {}

  private async findSubjectOrThrow(subjectId: number, userId: number) {
    const subject = await this.prisma.subject.findUnique({
      where: { id: subjectId },
    });
    if (!subject) throw new NotFoundException('Materia no encontrada');
    if (subject.userId !== userId)
      throw new ForbiddenException('No tienes acceso a esta materia');
    return subject;
  }

  // ─── Subjects ─────────────────────────────────────

  async create(userId: number, dto: CreateSubjectDto) {
    const subject = await this.prisma.subject.create({
      data: { ...dto, userId },
    });
    await this.gamification.addXp(userId, 10, XpActionType.CREATE_SUBJECT);
    return subject;
  }

  async findAll(userId: number) {
    return this.prisma.subject.findMany({
      where: { userId },
      include: {
        _count: { select: { tasks: true, notes: true, schedules: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(subjectId: number, userId: number) {
    const subject = await this.findSubjectOrThrow(subjectId, userId);
    return this.prisma.subject.findUnique({
      where: { id: subjectId },
      include: { schedules: true, tasks: true, notes: true },
    });
  }

  async update(subjectId: number, userId: number, dto: UpdateSubjectDto) {
    await this.findSubjectOrThrow(subjectId, userId);
    return this.prisma.subject.update({
      where: { id: subjectId },
      data: dto,
    });
  }

  async remove(subjectId: number, userId: number) {
    await this.findSubjectOrThrow(subjectId, userId);
    await this.prisma.subject.delete({ where: { id: subjectId } });
    return { message: 'Materia eliminada' };
  }

  // ─── Schedules ────────────────────────────────────

  async createSchedule(subjectId: number, userId: number, dto: CreateScheduleDto) {
    await this.findSubjectOrThrow(subjectId, userId);
    return this.prisma.schedule.create({
      data: { ...dto, subjectId },
    });
  }

  async findSchedules(subjectId: number, userId: number) {
    await this.findSubjectOrThrow(subjectId, userId);
    return this.prisma.schedule.findMany({
      where: { subjectId },
      orderBy: { dayOfWeek: 'asc' },
    });
  }

  async updateSchedule(
    scheduleId: number,
    subjectId: number,
    userId: number,
    dto: UpdateScheduleDto,
  ) {
    await this.findSubjectOrThrow(subjectId, userId);
    const schedule = await this.prisma.schedule.findUnique({
      where: { id: scheduleId },
    });
    if (!schedule) throw new NotFoundException('Horario no encontrado');
    return this.prisma.schedule.update({
      where: { id: scheduleId },
      data: dto,
    });
  }

  async removeSchedule(scheduleId: number, subjectId: number, userId: number) {
    await this.findSubjectOrThrow(subjectId, userId);
    const schedule = await this.prisma.schedule.findUnique({
      where: { id: scheduleId },
    });
    if (!schedule) throw new NotFoundException('Horario no encontrado');
    await this.prisma.schedule.delete({ where: { id: scheduleId } });
    return { message: 'Horario eliminado' };
  }

  // ─── Tasks ────────────────────────────────────────

  async createTask(subjectId: number, userId: number, dto: CreateTaskDto) {
    await this.findSubjectOrThrow(subjectId, userId);
    const task = await this.prisma.task.create({
      data: {
        title: dto.title,
        description: dto.description,
        priority: dto.priority,
        status: TaskStatus.PENDING,
        dueDate: new Date(dto.dueDate),
        subjectId,
      },
    });
    await this.gamification.addXp(userId, 15, XpActionType.CREATE_TASK);
    return task;
  }

  async findTasks(subjectId: number, userId: number) {
    await this.findSubjectOrThrow(subjectId, userId);
    return this.prisma.task.findMany({
      where: { subjectId },
      orderBy: { dueDate: 'asc' },
    });
  }

  async updateTask(
    taskId: number,
    subjectId: number,
    userId: number,
    dto: UpdateTaskDto,
  ) {
    await this.findSubjectOrThrow(subjectId, userId);
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });
    if (!task) throw new NotFoundException('Tarea no encontrada');

    const data: any = { ...dto };
    if (dto.dueDate) data.dueDate = new Date(dto.dueDate);

    return this.prisma.task.update({
      where: { id: taskId },
      data,
    });
  }

  async toggleTaskStatus(taskId: number, subjectId: number, userId: number) {
    await this.findSubjectOrThrow(subjectId, userId);
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });
    if (!task) throw new NotFoundException('Tarea no encontrada');

    const isCompleted = task.status === TaskStatus.COMPLETED;
    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        status: isCompleted ? TaskStatus.PENDING : TaskStatus.COMPLETED,
        completedAt: isCompleted ? null : new Date(),
      },
    });

    if (!isCompleted) {
      await this.gamification.addXp(userId, 25, XpActionType.COMPLETE_TASK);
    }

    return updated;
  }

  async removeTask(taskId: number, subjectId: number, userId: number) {
    await this.findSubjectOrThrow(subjectId, userId);
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });
    if (!task) throw new NotFoundException('Tarea no encontrada');
    await this.prisma.task.delete({ where: { id: taskId } });
    return { message: 'Tarea eliminada' };
  }

  // ─── Notes ────────────────────────────────────────

  async createNote(subjectId: number, userId: number, dto: CreateNoteDto) {
    await this.findSubjectOrThrow(subjectId, userId);
    const note = await this.prisma.note.create({
      data: { ...dto, subjectId },
    });
    await this.gamification.addXp(userId, 10, XpActionType.CREATE_NOTE);
    return note;
  }

  async findNotes(subjectId: number, userId: number) {
    await this.findSubjectOrThrow(subjectId, userId);
    return this.prisma.note.findMany({
      where: { subjectId },
      orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  async updateNote(
    noteId: number,
    subjectId: number,
    userId: number,
    dto: UpdateNoteDto,
  ) {
    await this.findSubjectOrThrow(subjectId, userId);
    const note = await this.prisma.note.findUnique({
      where: { id: noteId },
    });
    if (!note) throw new NotFoundException('Nota no encontrada');
    return this.prisma.note.update({
      where: { id: noteId },
      data: dto,
    });
  }

  async togglePinNote(noteId: number, subjectId: number, userId: number) {
    await this.findSubjectOrThrow(subjectId, userId);
    const note = await this.prisma.note.findUnique({
      where: { id: noteId },
    });
    if (!note) throw new NotFoundException('Nota no encontrada');
    return this.prisma.note.update({
      where: { id: noteId },
      data: { isPinned: !note.isPinned },
    });
  }

  async removeNote(noteId: number, subjectId: number, userId: number) {
    await this.findSubjectOrThrow(subjectId, userId);
    const note = await this.prisma.note.findUnique({
      where: { id: noteId },
    });
    if (!note) throw new NotFoundException('Nota no encontrada');
    await this.prisma.note.delete({ where: { id: noteId } });
    return { message: 'Nota eliminada' };
  }
}
