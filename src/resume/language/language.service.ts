import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLanguageDto } from '../dto/create-language.dto';
import { UpdateLanguageDto } from './dto/update-language.dto';

@Injectable()
export class LanguageService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateLanguageDto, userId: number) {
    const resume = await this.prisma.resume.findUnique({ where: { id: dto.resumeId } });
    if (!resume) throw new NotFoundException('Resume not found');
    if (resume.userId !== userId) throw new ForbiddenException();

    return this.prisma.language.create({
      data: {
        name: dto.name,
        level: dto.level as any,
        resume: { connect: { id: dto.resumeId! } },
      },
    });
  }

  async findAllByResume(resumeId: number, userId: number) {
    const resume = await this.prisma.resume.findUnique({ where: { id: resumeId } });
    if (!resume) throw new NotFoundException('Resume not found');
    if (resume.userId !== userId) throw new ForbiddenException();

    return this.prisma.language.findMany({ where: { resumeId }, orderBy: { id: 'desc' } });
  }

  async findOne(id: number, userId: number) {
    const item = await this.prisma.language.findUnique({ where: { id }, include: { resume: true } });
    if (!item) throw new NotFoundException('Language not found');
    if (item.resume.userId !== userId) throw new ForbiddenException();
    return item;
  }

  async update(id: number, dto: UpdateLanguageDto, userId: number) {
    const existing = await this.prisma.language.findUnique({ where: { id }, include: { resume: true } });
    if (!existing) throw new NotFoundException('Language not found');
    if (existing.resume.userId !== userId) throw new ForbiddenException();

    return this.prisma.language.update({ where: { id }, data: dto as any });
  }

  async remove(id: number, userId: number) {
    const existing = await this.prisma.language.findUnique({ where: { id }, include: { resume: true } });
    if (!existing) throw new NotFoundException('Language not found');
    if (existing.resume.userId !== userId) throw new ForbiddenException();

    return this.prisma.language.delete({ where: { id } });
  }
}
