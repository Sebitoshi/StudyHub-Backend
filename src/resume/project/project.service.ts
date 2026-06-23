import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateProjectDto, userId: number) {
    const resume = await this.prisma.resume.findUnique({ where: { id: dto.resumeId } });
    if (!resume) throw new NotFoundException('Resume not found');
    if (resume.userId !== userId) throw new ForbiddenException();

    return this.prisma.project.create({
      data: {
        title: dto.title,
        description: dto.description,
        githubUrl: dto.githubUrl,
        liveUrl: dto.liveUrl,
        technologies: dto.technologies ?? [],
        resumeId: dto.resumeId,
      },
    });
  }

  async findAllByResume(resumeId: number, userId: number) {
    const resume = await this.prisma.resume.findUnique({ where: { id: resumeId } });
    if (!resume) throw new NotFoundException('Resume not found');
    if (resume.userId !== userId) throw new ForbiddenException();

    return this.prisma.project.findMany({ where: { resumeId }, orderBy: { id: 'desc' } });
  }

  async findOne(id: number, userId: number) {
    const item = await this.prisma.project.findUnique({ where: { id }, include: { resume: true } });
    if (!item) throw new NotFoundException('Project not found');
    if (item.resume.userId !== userId) throw new ForbiddenException();
    return item;
  }

  async update(id: number, dto: UpdateProjectDto, userId: number) {
    const existing = await this.prisma.project.findUnique({ where: { id }, include: { resume: true } });
    if (!existing) throw new NotFoundException('Project not found');
    if (existing.resume.userId !== userId) throw new ForbiddenException();

    return this.prisma.project.update({ where: { id }, data: dto as any });
  }

  async remove(id: number, userId: number) {
    const existing = await this.prisma.project.findUnique({ where: { id }, include: { resume: true } });
    if (!existing) throw new NotFoundException('Project not found');
    if (existing.resume.userId !== userId) throw new ForbiddenException();

    return this.prisma.project.delete({ where: { id } });
  }
}
