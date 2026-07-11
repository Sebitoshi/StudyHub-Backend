import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCertificateDto } from '../dto/create-certificate.dto';
import { UpdateCertificateDto } from './dto/update-certificate.dto';

@Injectable()
export class CertificateService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateCertificateDto, userId: number) {
    const resume = await this.prisma.resume.findUnique({ where: { id: dto.resumeId } });
    if (!resume) throw new NotFoundException('Resume not found');
    if (resume.userId !== userId) throw new ForbiddenException();

    return this.prisma.certificate.create({
      data: {
        title: dto.title,
        issuer: dto.issuer,
        issueDate: dto.issueDate ? new Date(dto.issueDate) : null,
        credentialUrl: dto.credentialUrl,
        resume: { connect: { id: dto.resumeId! } },
      },
    });
  }

  async findAllByResume(resumeId: number, userId: number) {
    const resume = await this.prisma.resume.findUnique({ where: { id: resumeId } });
    if (!resume) throw new NotFoundException('Resume not found');
    if (resume.userId !== userId) throw new ForbiddenException();

    return this.prisma.certificate.findMany({ where: { resumeId }, orderBy: { issueDate: 'desc' } });
  }

  async findOne(id: number, userId: number) {
    const item = await this.prisma.certificate.findUnique({ where: { id }, include: { resume: true } });
    if (!item) throw new NotFoundException('Certificate not found');
    if (item.resume.userId !== userId) throw new ForbiddenException();
    return item;
  }

  async update(id: number, dto: UpdateCertificateDto, userId: number) {
    const existing = await this.prisma.certificate.findUnique({ where: { id }, include: { resume: true } });
    if (!existing) throw new NotFoundException('Certificate not found');
    if (existing.resume.userId !== userId) throw new ForbiddenException();

    const data: any = { ...dto };
    if (dto.issueDate) data.issueDate = new Date(dto.issueDate);

    return this.prisma.certificate.update({ where: { id }, data });
  }

  async remove(id: number, userId: number) {
    const existing = await this.prisma.certificate.findUnique({ where: { id }, include: { resume: true } });
    if (!existing) throw new NotFoundException('Certificate not found');
    if (existing.resume.userId !== userId) throw new ForbiddenException();

    return this.prisma.certificate.delete({ where: { id } });
  }
}
