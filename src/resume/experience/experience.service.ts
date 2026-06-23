import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateExperienceDto } from './dto/create-experience.dto';
import { UpdateExperienceDto } from './dto/update-experience.dto';

@Injectable()
export class ExperienceService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateExperienceDto, userId: number) {
    // verify resume ownership
    const resume = await this.prisma.resume.findUnique({ where: { id: dto.resumeId } });
    if (!resume) throw new NotFoundException('Resume not found');
    if (resume.userId !== userId) throw new ForbiddenException();

    const data = {
      company: dto.company,
      position: dto.position,
      description: dto.description,
      startDate: new Date(dto.startDate),
      endDate: dto.endDate ? new Date(dto.endDate) : null,
      isCurrent: dto.isCurrent ?? false,
      resumeId: dto.resumeId,
    };

    return this.prisma.experience.create({ data });
  }

  async findAllByResume(resumeId: number, userId: number) {
    const resume = await this.prisma.resume.findUnique({ where: { id: resumeId } });
    if (!resume) throw new NotFoundException('Resume not found');
    if (resume.userId !== userId) throw new ForbiddenException();

    return this.prisma.experience.findMany({ where: { resumeId }, orderBy: { startDate: 'desc' } });
  }

  async findOne(id: number, userId: number) {
    const item = await this.prisma.experience.findUnique({ where: { id }, include: { resume: true } });
    if (!item) throw new NotFoundException('Experience not found');
    if (item.resume.userId !== userId) throw new ForbiddenException();
    return item;
  }

  async update(id: number, dto: UpdateExperienceDto, userId: number) {
    const existing = await this.prisma.experience.findUnique({ where: { id }, include: { resume: true } });
    if (!existing) throw new NotFoundException('Experience not found');
    if (existing.resume.userId !== userId) throw new ForbiddenException();

    const data: any = {};
    if (dto.company) data.company = dto.company;
    if (dto.position) data.position = dto.position;
    if (dto.description) data.description = dto.description;
    if (dto.startDate) data.startDate = new Date(dto.startDate);
    if (dto.endDate) data.endDate = new Date(dto.endDate);
    if (typeof dto.isCurrent !== 'undefined') data.isCurrent = dto.isCurrent;

    return this.prisma.experience.update({ where: { id }, data });
  }

  async remove(id: number, userId: number) {
    const existing = await this.prisma.experience.findUnique({ where: { id }, include: { resume: true } });
    if (!existing) throw new NotFoundException('Experience not found');
    if (existing.resume.userId !== userId) throw new ForbiddenException();

    return this.prisma.experience.delete({ where: { id } });
  }
}
