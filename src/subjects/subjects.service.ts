import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GamificationService } from '../gamification/gamification.service';
import { MediaService } from '../media/media.service';
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
  private readonly logger = new Logger(SubjectsService.name);

  constructor(
    private prisma: PrismaService,
    private gamification: GamificationService,
    private media: MediaService,
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
    this.logger.log(`Creating subject "${dto.nombre}" for user ${userId}`);
    const subject = await this.prisma.subject.create({
      data: { ...dto, userId },
    });
    await this.gamification.addXp(userId, 10, XpActionType.CREATE_SUBJECT);
    this.logger.log(`Subject created (id: ${subject.id})`);
    return subject;
  }

  async findAll(userId: number) {
    this.logger.log(`Fetching all subjects for user ${userId}`);
    return this.prisma.subject.findMany({
      where: { userId },
      include: {
        _count: { select: { tasks: true, notes: true, schedules: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(subjectId: number, userId: number) {
    await this.findSubjectOrThrow(subjectId, userId);
    const subject = await this.prisma.subject.findUnique({
      where: { id: subjectId },
      include: { schedules: true, tasks: true, notes: true },
    });
    if (!subject) throw new NotFoundException('Materia no encontrada');
    return { ...subject, notes: await this.withNoteImages(userId, subject.notes) };
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
    this.logger.log(`Deleting subject ${subjectId} for user ${userId}`);
    await this.prisma.subject.delete({ where: { id: subjectId } });
    // Las imágenes viven en Mongo: Postgres no las borra en cascada.
    await this.media.deleteImagesForSubject(userId, subjectId).catch((error) => {
      this.logger.warn(`No se pudieron borrar las imágenes de la materia ${subjectId}: ${error}`);
    });
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

  /** Datos mínimos de una materia propia, para el asistente de apuntes. */
  async findSubjectBrief(subjectId: number, userId: number) {
    const subject = await this.findSubjectOrThrow(subjectId, userId);
    return { id: subject.id, nombre: subject.nombre };
  }

  // ─── Notes ────────────────────────────────────────

  async createNote(subjectId: number, userId: number, dto: CreateNoteDto) {
    await this.findSubjectOrThrow(subjectId, userId);
    const { imageIds, ...data } = dto;
    const note = await this.prisma.note.create({
      data: { ...data, subjectId },
    });
    if (imageIds?.length) {
      await this.media.attachImagesToNote(userId, note.id, imageIds);
    }
    await this.gamification.addXp(userId, 10, XpActionType.CREATE_NOTE);
    const [withImages] = await this.withNoteImages(userId, [note]);
    return withImages;
  }

  async findNotes(subjectId: number, userId: number) {
    await this.findSubjectOrThrow(subjectId, userId);
    const notes = await this.prisma.note.findMany({
      where: { subjectId },
      orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
    });
    return this.withNoteImages(userId, notes);
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

    const { imageIds, ...data } = dto;
    const updated = await this.prisma.note.update({
      where: { id: noteId },
      data,
    });
    if (imageIds?.length) {
      await this.media.attachImagesToNote(userId, updated.id, imageIds);
    }

    const [withImages] = await this.withNoteImages(userId, [updated]);
    return withImages;
  }

  /**
   * Adjunta a cada apunte sus imágenes (url, dimensiones) para que el frontend
   * pueda mostrarlas, agrandarlas y abrirlas a pantalla completa.
   */
  private async withNoteImages<T extends { id: number }>(userId: number, notes: T[]) {
    if (!notes.length) return notes.map((note) => ({ ...note, images: [] }));

    const images = await this.media
      .listNoteImages(userId, notes.map((note) => note.id))
      .catch((error) => {
        this.logger.warn(`No se pudieron leer las imágenes de los apuntes: ${error}`);
        return [];
      });

    const byNote = new Map<number, typeof images>();
    for (const image of images) {
      if (image.noteId == null) continue;
      const list = byNote.get(image.noteId) ?? [];
      list.push(image);
      byNote.set(image.noteId, list);
    }

    return notes.map((note) => ({ ...note, images: byNote.get(note.id) ?? [] }));
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
    await this.media.deleteImagesForNote(userId, noteId).catch((error) => {
      this.logger.warn(`No se pudieron borrar las imágenes de la nota ${noteId}: ${error}`);
    });
    return { message: 'Nota eliminada' };
  }
}
