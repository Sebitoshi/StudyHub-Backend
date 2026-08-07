import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateSandboxExerciseDto,
  UpdateSandboxExerciseDto,
  CreateSandboxAttemptDto,
} from './dto/sandbox.dto';

@Injectable()
export class SandboxService {
  constructor(private readonly prisma: PrismaService) {}

  // ───────────── Ejercicios ─────────────

  async getExercises(userId: number) {
    return this.prisma.sandboxExercise.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { attempts: true } } },
    });
  }

  async createExercise(userId: number, dto: CreateSandboxExerciseDto) {
    return this.prisma.sandboxExercise.create({
      data: {
        userId,
        title: dto.title,
        language: dto.language,
        description: dto.description || '',
        code: dto.code || '',
        tests: JSON.parse(JSON.stringify(dto.tests || [])) as Prisma.InputJsonValue,
      },
    });
  }

  async updateExercise(userId: number, id: number, dto: UpdateSandboxExerciseDto) {
    const existing = await this.prisma.sandboxExercise.findFirst({
      where: { id, userId },
    });
    if (!existing) throw new NotFoundException('Ejercicio no encontrado');

    return this.prisma.sandboxExercise.update({
      where: { id },
      data: {
        title: dto.title,
        language: dto.language,
        description: dto.description || '',
        code: dto.code || '',
        tests: JSON.parse(JSON.stringify(dto.tests || [])) as Prisma.InputJsonValue,
      },
    });
  }

  async deleteExercise(userId: number, id: number) {
    const existing = await this.prisma.sandboxExercise.findFirst({
      where: { id, userId },
    });
    if (!existing) throw new NotFoundException('Ejercicio no encontrado');

    await this.prisma.sandboxExercise.delete({ where: { id } });
    return { ok: true };
  }

  // ───────────── Intentos ─────────────

  async createAttempt(userId: number, dto: CreateSandboxAttemptDto) {
    return this.prisma.sandboxAttempt.create({
      data: {
        userId,
        exerciseId: dto.exerciseId || null,
        language: dto.language,
        code: dto.code || '',
        output: dto.output || '',
        passed: dto.passed ?? false,
        testedCases: dto.testedCases ?? 0,
        passedCases: dto.passedCases ?? 0,
      },
    });
  }

  async getAttempts(userId: number, exerciseId?: number) {
    return this.prisma.sandboxAttempt.findMany({
      where: { userId, ...(exerciseId ? { exerciseId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async clearAttempts(userId: number) {
    await this.prisma.sandboxAttempt.deleteMany({ where: { userId } });
    return { ok: true };
  }

  // ───────────── Stats ─────────────

  async getStats(userId: number) {
    const [attempts, passed, exercisesSaved] = await Promise.all([
      this.prisma.sandboxAttempt.count({ where: { userId } }),
      this.prisma.sandboxAttempt.count({ where: { userId, passed: true } }),
      this.prisma.sandboxExercise.count({ where: { userId } }),
    ]);
    return { attempts, passed, exercisesSaved };
  }
}
