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
    country?: string;
    city?: string;
    company?: string;
    search?: string;
    modality?: string;
    studentFriendly?: boolean;
  }) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const conditions: any[] = [];
    if (filters.isRemote !== undefined) conditions.push({ isRemote: filters.isRemote });
    if (filters.contractType) conditions.push({ contractType: filters.contractType });
    if (filters.salaryMin) conditions.push({ salaryMin: { gte: filters.salaryMin } });
    if (filters.salaryMax) conditions.push({ salaryMax: { lte: filters.salaryMax } });
    if (filters.seniority) conditions.push({ seniority: filters.seniority });
    if (filters.location) conditions.push({ location: { contains: filters.location, mode: 'insensitive' } });
    if (filters.company) conditions.push({ company: { contains: filters.company, mode: 'insensitive' } });
    if (filters.modality) conditions.push({ modality: filters.modality });
    if (filters.studentFriendly !== undefined) conditions.push({ studentFriendly: filters.studentFriendly });
    if (filters.skills && filters.skills.length > 0) {
      conditions.push({ skills: { hasSome: filters.skills } });
    }

    if (filters.country) {
      conditions.push({
        OR: [
          { country: { contains: filters.country, mode: 'insensitive' } },
          { location: { contains: filters.country, mode: 'insensitive' } },
        ],
      });
    }
    if (filters.city) {
      conditions.push({
        OR: [
          { city: { contains: filters.city, mode: 'insensitive' } },
          { location: { contains: filters.city, mode: 'insensitive' } },
        ],
      });
    }
    if (filters.search) {
      conditions.push({
        OR: [
          { title: { contains: filters.search, mode: 'insensitive' } },
          { company: { contains: filters.search, mode: 'insensitive' } },
          { skills: { has: filters.search } },
        ],
      });
    }
    const where = conditions.length > 0 ? { AND: conditions } : {};

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

  async withdrawApplication(userId: number, jobId: number) {
    const application = await this.prisma.jobApplication.findUnique({
      where: { userId_jobId: { userId, jobId } },
    });
    if (!application) throw new NotFoundException('No te has postulado a este empleo');
    await this.prisma.jobApplication.delete({ where: { id: application.id } });
    return { ok: true };
  }

  async getApplications(userId: number) {
    return this.prisma.jobApplication.findMany({
      where: { userId },
      include: { job: true },
      orderBy: { appliedAt: 'desc' },
    });
  }
}
