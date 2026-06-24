import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JobApplicationStatus } from '@prisma/client';

@Injectable()
export class JobsService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters: {
    page?: number;
    limit?: number;
    sortBy?: string;
    order?: string;
    isRemote?: boolean;
    contractType?: string;
    salaryMin?: number;
    salaryMax?: number;
    seniority?: string;
    skills?: string[];
    location?: string;
    company?: string;
  }) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters.isRemote !== undefined) where.isRemote = filters.isRemote;
    if (filters.contractType) where.contractType = filters.contractType;
    if (filters.salaryMin) where.salaryMin = { gte: filters.salaryMin };
    if (filters.salaryMax) where.salaryMax = { lte: filters.salaryMax };
    if (filters.seniority) where.seniority = filters.seniority;
    if (filters.location) where.location = { contains: filters.location, mode: 'insensitive' };
    if (filters.company) where.company = { contains: filters.company, mode: 'insensitive' };
    if (filters.skills && filters.skills.length > 0) {
      where.skills = { hasSome: filters.skills };
    }

    const allowedSortFields = ['publishedAt', 'salaryMin', 'salaryMax', 'title', 'company'];
    const sortField = filters.sortBy && allowedSortFields.includes(filters.sortBy) ? filters.sortBy : 'publishedAt';
    const sortOrder = filters.order === 'asc' ? 'asc' : 'desc';

    const [jobs, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortField]: sortOrder },
      }),
      this.prisma.job.count({ where }),
    ]);

    return { jobs, total, page, limit };
  }

  async findOne(id: number) {
    const job = await this.prisma.job.findUnique({
      where: { id },
    });
    if (!job) throw new NotFoundException('Empleo no encontrado');
    return job;
  }

  // --- SAVED JOBS ---

  async saveJob(userId: number, jobId: number) {
    await this.findOne(jobId); // Verify it exists

    const existing = await this.prisma.savedJob.findUnique({
      where: { userId_jobId: { userId, jobId } },
    });

    if (existing) return existing;

    return this.prisma.savedJob.create({
      data: { userId, jobId },
    });
  }

  async unsaveJob(userId: number, jobId: number) {
    const existing = await this.prisma.savedJob.findUnique({
      where: { userId_jobId: { userId, jobId } },
    });

    if (!existing) throw new NotFoundException('El empleo no estaba guardado');

    await this.prisma.savedJob.delete({
      where: { id: existing.id },
    });
    return { ok: true };
  }

  async getSavedJobs(userId: number) {
    return this.prisma.savedJob.findMany({
      where: { userId },
      include: { job: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // --- APPLICATIONS ---

  async applyToJob(userId: number, jobId: number, notes?: string) {
    await this.findOne(jobId);

    const existing = await this.prisma.jobApplication.findUnique({
      where: { userId_jobId: { userId, jobId } },
    });

    if (existing) throw new ConflictException('Ya te postulaste a este empleo');

    const statusHistory = [{ status: JobApplicationStatus.APPLIED, date: new Date().toISOString() }];

    return this.prisma.jobApplication.create({
      data: {
        userId,
        jobId,
        status: JobApplicationStatus.APPLIED,
        statusHistory,
        notes,
      },
    });
  }

  async updateApplicationStatus(userId: number, jobId: number, status: JobApplicationStatus) {
    const application = await this.prisma.jobApplication.findUnique({
      where: { userId_jobId: { userId, jobId } },
    });

    if (!application) throw new NotFoundException('No te has postulado a este empleo');

    const history = Array.isArray(application.statusHistory) 
      ? application.statusHistory 
      : (typeof application.statusHistory === 'string' ? JSON.parse(application.statusHistory) : []);

    const newHistory = [...history, { status, date: new Date().toISOString() }];

    return this.prisma.jobApplication.update({
      where: { id: application.id },
      data: {
        status,
        statusHistory: newHistory,
      },
    });
  }

  async getApplications(userId: number) {
    return this.prisma.jobApplication.findMany({
      where: { userId },
      include: { job: true },
      orderBy: { appliedAt: 'desc' },
    });
  }
}
