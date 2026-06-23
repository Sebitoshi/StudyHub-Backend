import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEducationDto } from './dto/create-education.dto';
import { UpdateEducationDto } from './dto/update-education.dto';

@Injectable()
export class EducationService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateEducationDto, userId: number) {
    const resume = await this.prisma.resume.findUnique({ where: { id: dto.resumeId } });
    if (!resume) throw new NotFoundException('Resume not found');
    if (resume.userId !== userId) throw new ForbiddenException();

    return this.prisma.education.create({
      data: {
        institution: dto.institution,
        degree: dto.degree,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        isCurrent: dto.isCurrent ?? false,
        resumeId: dto.resumeId,
      },
    });
  }

  async findAllByResume(resumeId: number, userId: number) {
    const resume = await this.prisma.resume.findUnique({ where: { id: resumeId } });
    if (!resume) throw new NotFoundException('Resume not found');
    if (resume.userId !== userId) throw new ForbiddenException();

    return this.prisma.education.findMany({ where: { resumeId }, orderBy: { startDate: 'desc' } });
  }

  async findOne(id: number, userId: number) {
    const item = await this.prisma.education.findUnique({ where: { id }, include: { resume: true } });
    if (!item) throw new NotFoundException('Education not found');
    if (item.resume.userId !== userId) throw new ForbiddenException();
    return item;
  }

  async update(id: number, dto: UpdateEducationDto, userId: number) {
    const existing = await this.prisma.education.findUnique({ where: { id }, include: { resume: true } });
    if (!existing) throw new NotFoundException('Education not found');
    if (existing.resume.userId !== userId) throw new ForbiddenException();

    const data: any = { ...dto };
    if (dto.startDate) data.startDate = new Date(dto.startDate);
    if (dto.endDate) data.endDate = new Date(dto.endDate);

    return this.prisma.education.update({ where: { id }, data });
  }

  async remove(id: number, userId: number) {
    const existing = await this.prisma.education.findUnique({ where: { id }, include: { resume: true } });
    if (!existing) throw new NotFoundException('Education not found');
    if (existing.resume.userId !== userId) throw new ForbiddenException();

    return this.prisma.education.delete({ where: { id } });
  }
}
