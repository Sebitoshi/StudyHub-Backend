import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateResumeDto } from './dto/create-resume.dto';
import { UpdateResumeDto } from './dto/update-resume.dto';
import puppeteer from 'puppeteer';

function renderHtml(resume: any) {
  const paragraphs = (resume.resumen || '').split(/\n{2,}/).map((p: string) => `<p>${p.replace(/\n/g, '<br/>')}</p>`).join('');

  const user = resume.user || {};
  const desired = user.professionalProfile?.cargoDeseado || '';
  const contactParts = [user.email, user.ciudad ? `${user.ciudad}${user.pais ? ', ' + user.pais : ''}` : null, user.github, user.linkedin, user.paginaPersonal].filter(Boolean);
  const contactHtml = contactParts.join(' | ');
  const skillsHtml = (user.skills || []).map((s: any) => s.skill?.nombre).filter(Boolean).join(', ');

  const experiencesHtml = (resume.experiences || []).map((e: any) => `
    <div style="margin-bottom:8px">
      <strong>${e.position}</strong> — ${e.company} <span style="color:#666">(${new Date(e.startDate).getFullYear()} - ${e.endDate ? new Date(e.endDate).getFullYear() : 'Present'})</span>
      ${e.location ? `<div>${e.location}</div>` : ''}
      ${e.employmentType ? `<div><em>${e.employmentType}</em></div>` : ''}
      ${e.description ? `<div>${e.description}</div>` : ''}
    </div>
  `).join('');

  const projectsHtml = (resume.projects || []).map((p: any) => `
    <div style="margin-bottom:8px">
      <strong>${p.title}</strong>
      ${p.githubUrl ? `<div>GitHub: <a href="${p.githubUrl}">${p.githubUrl}</a></div>` : ''}
      ${p.liveUrl ? `<div>Live: <a href="${p.liveUrl}">${p.liveUrl}</a></div>` : ''}
      <div>${p.description}</div>
    </div>
  `).join('');

  const educationsHtml = (resume.educations || []).map((ed: any) => `
    <div style="margin-bottom:8px">
      <strong>${ed.degree}</strong> — ${ed.institution} <span style="color:#666">(${new Date(ed.startDate).getFullYear()} - ${ed.endDate ? new Date(ed.endDate).getFullYear() : 'Present'})</span>
    </div>
  `).join('');

  const certificatesHtml = (resume.certificates || []).map((c: any) => `
    <div style="margin-bottom:6px">
      <strong>${c.title}</strong> — ${c.issuer} ${c.issueDate ? `<span style="color:#666">(${new Date(c.issueDate).getFullYear()})</span>` : ''}
    </div>
  `).join('');

  const languagesHtml = (resume.languages || []).map((l: any) => `
    <div>${l.name} — ${l.level}</div>
  `).join('');

  return `
  <!doctype html>
  <html>
  <head>
    <meta charset="utf-8" />
    <title>Resume</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 12px; color: #222; padding: 28px; line-height:1.35 }
      h1 { margin:0; font-size:20px }
      h2 { margin:8px 0; font-size:14px }
      .header { border-bottom: 1px solid #ddd; padding-bottom:10px; margin-bottom:12px }
      .contact { color:#666; font-size:11px; margin-top:6px }
      .section { margin-top:12px }
      .muted { color:#666; font-size:11px }
      .skills { margin-top:6px }
    </style>
  </head>
  <body>
    <div class="header">
      <h1>${resume.titulo || (user.nombre ? user.nombre + ' ' + (user.apellido||'') : 'Curriculum Vitae')}</h1>
      ${desired ? `<div style="font-weight:600">${desired}</div>` : ''}
      <div class="contact">${contactHtml}</div>
      ${skillsHtml ? `<div class="skills"><strong>Skills:</strong> ${skillsHtml}</div>` : ''}
    </div>

    <div class="section">
      <h2>Professional Summary</h2>
      <div class="muted">${paragraphs}</div>
    </div>

    <div class="section">
      <h2>Experience</h2>
      ${experiencesHtml}
    </div>

    <div class="section">
      <h2>Education</h2>
      ${educationsHtml}
    </div>

    <div class="section">
      <h2>Projects</h2>
      ${projectsHtml}
    </div>

    <div class="section">
      <h2>Certificates</h2>
      ${certificatesHtml}
    </div>

    <div class="section">
      <h2>Languages</h2>
      ${languagesHtml}
    </div>
  </body>
  </html>
  `;
}

@Injectable()
export class ResumeService {
  constructor(private prisma: PrismaService) {}

  async findByUser(userId: number) {
    const resume = await this.prisma.resume.findUnique({
      where: { userId },
      include: {
        experiences: true,
        educations: true,
        projects: true,
        certificates: true,
        languages: true,
      },
    });

    if (!resume) {
      throw new NotFoundException('Resume not found');
    }

    return resume;
  }

  async create(dto: CreateResumeDto) {
    const { userId, titulo, resumen } = dto;

    const existing = await this.prisma.resume.findUnique({ where: { userId } });
    if (existing) {
      return this.update(userId, dto as any);
    }

    return this.prisma.resume.create({
      data: {
        userId,
        titulo,
        resumen,
        experiences: { create: dto.experiences ?? [] },
        educations: { create: dto.educations ?? [] },
        projects: { create: dto.projects ?? [] },
        certificates: { create: dto.certificates ?? [] },
        languages: { create: dto.languages ?? [] },
      },
      include: {
        experiences: true,
        educations: true,
        projects: true,
        certificates: true,
        languages: true,
      },
    });
  }

  async update(userId: number, dto: UpdateResumeDto) {
    const existing = await this.prisma.resume.findUnique({ where: { userId } });
    if (!existing) {
      throw new NotFoundException('Resume not found');
    }

    // Update basic fields
    await this.prisma.resume.update({ where: { userId }, data: { titulo: dto.titulo, resumen: dto.resumen } });

    // Replace nested lists: delete existing and recreate
    await this.prisma.$transaction([
      this.prisma.experience.deleteMany({ where: { resumeId: existing.id } }),
      this.prisma.education.deleteMany({ where: { resumeId: existing.id } }),
      this.prisma.project.deleteMany({ where: { resumeId: existing.id } }),
      this.prisma.certificate.deleteMany({ where: { resumeId: existing.id } }),
      this.prisma.language.deleteMany({ where: { resumeId: existing.id } }),
    ]);

    await this.prisma.$transaction([
      ...(dto.experiences && dto.experiences.length
        ? [this.prisma.experience.createMany({ data: dto.experiences.map((e) => ({ ...e, resumeId: existing.id })) })]
        : []),
      ...(dto.educations && dto.educations.length
        ? [this.prisma.education.createMany({ data: dto.educations.map((e) => ({ ...e, resumeId: existing.id })) })]
        : []),
      ...(dto.projects && dto.projects.length
        ? [this.prisma.project.createMany({ data: dto.projects.map((p) => ({ ...p, resumeId: existing.id })) })]
        : []),
      ...(dto.certificates && dto.certificates.length
        ? [this.prisma.certificate.createMany({ data: dto.certificates.map((c) => ({ ...c, resumeId: existing.id })) })]
        : []),
      ...(dto.languages && dto.languages.length
        ? [this.prisma.language.createMany({ data: dto.languages.map((l) => ({ ...l, resumeId: existing.id })) })]
        : []),
    ]);

    return this.findByUser(userId);
  }

  async generatePdf(userId: number) {
    const resume = await this.prisma.resume.findUnique({
      where: { userId },
      include: {
        user: {
          include: { professionalProfile: true, skills: { include: { skill: true } } },
        },
        experiences: true,
        educations: true,
        projects: true,
        certificates: true,
        languages: true,
      },
    });

    if (!resume) throw new NotFoundException('Resume not found');

    const html = renderHtml(resume);

    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      const pdf = await page.pdf({ format: 'A4', printBackground: true });
      return pdf;
    } finally {
      await browser.close();
    }
  }
}
