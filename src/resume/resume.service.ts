import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateResumeDto } from './dto/create-resume.dto';
import { UpdateResumeDto } from './dto/update-resume.dto';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

function renderHtml(resume: any) {
  const user = resume.user || {};
  const fullName = resume.titulo
    ? `${user.nombre || ''} ${user.apellido || ''}`.trim()
    : `${user.nombre || ''} ${user.apellido || ''}`.trim();
  const jobTitle = resume.titulo || user.professionalProfile?.cargoDeseado || '';

  // Build contact links
  const contactItems: string[] = [];
  if (user.email)
    contactItems.push(`<a href="mailto:${user.email}" style="color:#0f766e;text-decoration:none">${user.email}</a>`);
  if (user.telefono)
    contactItems.push(`<a href="tel:${user.telefono}" style="color:#0f766e;text-decoration:none">${user.telefono}</a>`);
  if (user.ciudad || user.pais)
    contactItems.push(`<span>${[user.ciudad, user.pais].filter(Boolean).join(', ')}</span>`);
  if (user.linkedin)
    contactItems.push(`<a href="${user.linkedin.startsWith('http') ? user.linkedin : 'https://linkedin.com/in/' + user.linkedin}" style="color:#0f766e;text-decoration:none">LinkedIn</a>`);
  if (user.github)
    contactItems.push(`<a href="${user.github.startsWith('http') ? user.github : 'https://github.com/' + user.github}" style="color:#0f766e;text-decoration:none">GitHub</a>`);
  if (user.portafolio)
    contactItems.push(`<a href="${user.portafolio.startsWith('http') ? user.portafolio : 'https://' + user.portafolio}" style="color:#0f766e;text-decoration:none">Portafolio</a>`);
  if (user.paginaPersonal)
    contactItems.push(`<a href="${user.paginaPersonal.startsWith('http') ? user.paginaPersonal : 'https://' + user.paginaPersonal}" style="color:#0f766e;text-decoration:none">Web personal</a>`);

  const contactHtml = contactItems.join('<span style="color:#ccc;margin:0 6px">|</span>');

  // Skills
  const skillsHtml = (user.skills || []).map((s: any) => s.skill?.nombre).filter(Boolean).join(' • ');

  // Summary
  const summaryHtml = (resume.resumen || '').split(/\n{2,}/).map((p: string) =>
    `<p style="margin:0 0 6px 0">${p.replace(/\n/g, '<br/>')}</p>`
  ).join('');

  // Section header helper
  const sectionHeader = (title: string) =>
    `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
      <div style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#0f766e">${title}</div>
      <div style="flex:1;height:1px;background:#e5e7eb"></div>
    </div>`;

  // Experiences
  const experiencesHtml = (resume.experiences || []).map((e: any) => `
    <div style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <div style="font-weight:700;font-size:11.5px;color:#111">${e.position}</div>
          <div style="font-size:10.5px;color:#666;margin-top:1px">${e.company}</div>
        </div>
        <div style="font-size:10px;color:#888;background:#f3f4f6;padding:2px 8px;border-radius:4px;white-space:nowrap">
          ${new Date(e.startDate).toLocaleDateString('es-ES', { year: 'numeric', month: 'short' })} –
          ${e.isCurrent ? 'Presente' : (e.endDate ? new Date(e.endDate).toLocaleDateString('es-ES', { year: 'numeric', month: 'short' }) : '')}
        </div>
      </div>
      ${e.description ? `<div style="font-size:10.5px;color:#555;margin-top:5px;line-height:1.5">${e.description.replace(/\n/g, '<br/>')}</div>` : ''}
    </div>
  `).join('');

  // Education
  const educationsHtml = (resume.educations || []).map((ed: any) => `
    <div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <div style="font-weight:700;font-size:11.5px;color:#111">${ed.degree}</div>
          <div style="font-size:10.5px;color:#666;margin-top:1px">${ed.institution}</div>
        </div>
        <div style="font-size:10px;color:#888;background:#f3f4f6;padding:2px 8px;border-radius:4px;white-space:nowrap">
          ${new Date(ed.startDate).toLocaleDateString('es-ES', { year: 'numeric', month: 'short' })} –
          ${ed.isCurrent ? 'Presente' : (ed.endDate ? new Date(ed.endDate).toLocaleDateString('es-ES', { year: 'numeric', month: 'short' }) : '')}
        </div>
      </div>
    </div>
  `).join('');

  // Projects
  const projectsHtml = (resume.projects || []).map((p: any) => `
    <div style="margin-bottom:12px">
      <div style="display:flex;align-items:baseline;gap:8px">
        <div style="font-weight:700;font-size:11.5px;color:#111">${p.title}</div>
        ${p.githubUrl ? `<a href="${p.githubUrl}" style="font-size:10px;color:#0f766e;text-decoration:none">GitHub ↗</a>` : ''}
        ${p.liveUrl ? `<a href="${p.liveUrl}" style="font-size:10px;color:#0f766e;text-decoration:none">Demo ↗</a>` : ''}
      </div>
      ${p.technologies?.length ? `<div style="margin-top:3px;font-size:10px;color:#0f766e;font-weight:600">${p.technologies.join(' · ')}</div>` : ''}
      <div style="font-size:10.5px;color:#555;margin-top:4px;line-height:1.5">${p.description}</div>
    </div>
  `).join('');

  // Certificates
  const certificatesHtml = (resume.certificates || []).map((c: any) => `
    <div style="margin-bottom:6px;font-size:10.5px">
      <span style="font-weight:700;color:#111">${c.title}</span>
      <span style="color:#666"> — ${c.issuer}</span>
      ${c.issueDate ? `<span style="color:#888"> (${new Date(c.issueDate).toLocaleDateString('es-ES', { year: 'numeric', month: 'short' })})</span>` : ''}
      ${c.credentialUrl ? ` <a href="${c.credentialUrl}" style="color:#0f766e;font-size:9.5px;text-decoration:none">Ver credencial ↗</a>` : ''}
    </div>
  `).join('');

  // Languages
  const levelMap: Record<string, string> = { BASIC: 'Básico', INTERMEDIATE: 'Intermedio', ADVANCED: 'Avanzado', NATIVE: 'Nativo' };
  const languagesHtml = (resume.languages || []).map((l: any) =>
    `<span style="display:inline-block;background:#f0fdf4;border:1px solid #bbf7d0;color:#065f46;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:600;margin:0 4px 4px 0">${l.name} · ${levelMap[l.level] || l.level}</span>`
  ).join('');

  return `
  <!doctype html>
  <html>
  <head>
    <meta charset="utf-8" />
    <title>${fullName} — CV</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: 'Inter', Arial, sans-serif;
        font-size: 11px;
        color: #222;
        background: #fff;
        padding: 36px 40px;
        line-height: 1.45;
      }
      a { color: #0f766e; }
    </style>
  </head>
  <body>
    <!-- Header -->
    <div style="border-bottom:2px solid #0f766e;padding-bottom:14px;margin-bottom:18px">
      <h1 style="font-size:22px;font-weight:700;color:#111;letter-spacing:-.02em">${fullName}</h1>
      ${jobTitle ? `<div style="font-size:13px;font-weight:600;color:#0f766e;margin-top:3px">${jobTitle}</div>` : ''}
      <div style="margin-top:8px;font-size:10.5px;color:#555">${contactHtml}</div>
      ${skillsHtml ? `<div style="margin-top:8px;font-size:10.5px;color:#374151"><strong style="color:#111">Skills:</strong> ${skillsHtml}</div>` : ''}
    </div>

    ${resume.resumen ? `
    <div style="margin-bottom:18px">
      ${sectionHeader('Perfil profesional')}
      <div style="font-size:10.5px;color:#555;line-height:1.6">${summaryHtml}</div>
    </div>
    ` : ''}

    ${resume.experiences?.length ? `
    <div style="margin-bottom:18px">
      ${sectionHeader('Experiencia')}
      ${experiencesHtml}
    </div>
    ` : ''}

    ${resume.educations?.length ? `
    <div style="margin-bottom:18px">
      ${sectionHeader('Educación')}
      ${educationsHtml}
    </div>
    ` : ''}

    ${resume.projects?.length ? `
    <div style="margin-bottom:18px">
      ${sectionHeader('Proyectos')}
      ${projectsHtml}
    </div>
    ` : ''}

    ${resume.certificates?.length ? `
    <div style="margin-bottom:18px">
      ${sectionHeader('Certificados')}
      ${certificatesHtml}
    </div>
    ` : ''}

    ${resume.languages?.length ? `
    <div style="margin-bottom:18px">
      ${sectionHeader('Idiomas')}
      <div style="margin-top:2px">${languagesHtml}</div>
    </div>
    ` : ''}
  </body>
  </html>
  `;
}

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 60);
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
      throw new NotFoundException('CV no encontrado');
    }

    return resume;
  }

  async findBySlug(slug: string) {
    const resume = await this.prisma.resume.findUnique({
      where: { slug },
      include: {
        experiences: true,
        educations: true,
        projects: true,
        certificates: true,
        languages: true,
        user: {
          select: { nombre: true, apellido: true, email: true },
        },
      },
    });

    if (!resume) {
      throw new NotFoundException('CV no encontrado');
    }

    return resume;
  }

  async create(userId: number, dto: CreateResumeDto) {
    const existing = await this.prisma.resume.findUnique({ where: { userId } });
    if (existing) {
      return this.update(userId, dto as any);
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const baseSlug = generateSlug(`${user?.nombre || 'user'}-${user?.apellido || userId}`);
    const slug = dto.slug || `${baseSlug}-${Date.now()}`;

    return this.prisma.resume.create({
      data: {
        userId,
        titulo: dto.titulo,
        resumen: dto.resumen,
        slug,
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
      throw new NotFoundException('CV no encontrado');
    }

    await this.prisma.resume.update({
      where: { userId },
      data: {
        titulo: dto.titulo,
        resumen: dto.resumen,
        ...(dto.slug ? { slug: dto.slug } : {}),
      },
    });

    await this.prisma.$transaction([
      this.prisma.experience.deleteMany({ where: { resumeId: existing.id } }),
      this.prisma.education.deleteMany({ where: { resumeId: existing.id } }),
      this.prisma.project.deleteMany({ where: { resumeId: existing.id } }),
      this.prisma.certificate.deleteMany({ where: { resumeId: existing.id } }),
      this.prisma.language.deleteMany({ where: { resumeId: existing.id } }),
    ]);

    await this.prisma.$transaction([
      ...(dto.experiences && dto.experiences.length
        ? [this.prisma.experience.createMany({
            data: dto.experiences.map((e) => ({
              ...e,
              startDate: new Date(e.startDate),
              endDate: e.endDate ? new Date(e.endDate) : null,
              resumeId: existing.id,
            })),
          })]
        : []),
      ...(dto.educations && dto.educations.length
        ? [this.prisma.education.createMany({
            data: dto.educations.map((e) => ({
              ...e,
              startDate: new Date(e.startDate),
              endDate: e.endDate ? new Date(e.endDate) : null,
              resumeId: existing.id,
            })),
          })]
        : []),
      ...(dto.projects && dto.projects.length
        ? [this.prisma.project.createMany({ data: dto.projects.map((p) => ({ ...p, resumeId: existing.id })) })]
        : []),
      ...(dto.certificates && dto.certificates.length
        ? [this.prisma.certificate.createMany({
            data: dto.certificates.map((c) => ({
              ...c,
              issueDate: c.issueDate ? new Date(c.issueDate) : null,
              resumeId: existing.id,
            })),
          })]
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

    if (!resume) throw new NotFoundException('CV no encontrado');

    const html = renderHtml(resume);

    let executablePath: string;
    let args: string[];
    if (process.env.VERCEL) {
      executablePath = await chromium.executablePath();
      args = chromium.args;
    } else {
      executablePath = process.env.CHROMIUM_PATH || '/home/sebas/.cache/puppeteer/chrome/linux-150.0.7871.24/chrome-linux64/chrome';
      args = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'];
    }
    const browser = await puppeteer.launch({ args, executablePath });
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
