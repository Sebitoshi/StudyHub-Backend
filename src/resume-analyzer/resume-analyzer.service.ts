import {
  Injectable,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GroqService } from '../ai/groq.service';

@Injectable()
export class ResumeAnalyzerService {
  private readonly logger = new Logger(ResumeAnalyzerService.name);

  constructor(
    private prisma: PrismaService,
    private groq: GroqService,
  ) {}

  async analyzeFile(userId: number, file: Express.Multer.File) {
    const text = await this.parseFile(file);
    return this.analyze(userId, text, null);
  }

  async analyzeProfile(userId: number) {
    const resume = await this.prisma.resume.findUnique({
      where: { userId },
      include: {
        experiences: true,
        educations: true,
        projects: true,
        certificates: true,
        languages: true,
        user: {
          include: {
            skills: { include: { skill: true } },
            professionalProfile: true,
          },
        },
      },
    });

    if (!resume)
      throw new NotFoundException(
        'No tienes un CV creado. Crea tu perfil primero.',
      );

    const text = this.buildProfileText(resume);
    const analysis = await this.analyze(userId, text, resume.id);
    return analysis;
  }

  private async parseFile(file: Express.Multer.File): Promise<string> {
    const mime = file.mimetype;
    const ext = file.originalname.split('.').pop()?.toLowerCase();

    if (mime === 'application/pdf' || ext === 'pdf') {
      return this.parsePdf(file.buffer);
    }

    if (
      mime ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      ext === 'docx'
    ) {
      return this.parseDocx(file.buffer);
    }

    throw new BadRequestException('Formato no soportado. Solo PDF y DOCX.');
  }

  private async parsePdf(buffer: Buffer): Promise<string> {
    try {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);
      return data.text || '';
    } catch {
      throw new BadRequestException('Error al leer el archivo PDF');
    }
  }

  private async parseDocx(buffer: Buffer): Promise<string> {
    try {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      return result.value || '';
    } catch {
      throw new BadRequestException('Error al leer el archivo DOCX');
    }
  }

  private buildProfileText(resume: any): string {
    const parts: string[] = [];
    const user = resume.user || {};

    if (resume.titulo) parts.push(`Título: ${resume.titulo}`);
    if (resume.resumen) parts.push(`Resumen: ${resume.resumen}`);

    const profProfile = user.professionalProfile;
    if (profProfile) {
      parts.push(`Cargo deseado: ${profProfile.cargoDeseado}`);
      parts.push(`Nivel actual: ${profProfile.nivelActual}`);
    }

    const skills = (user.skills || [])
      .map((s: any) => s.skill?.nombre)
      .filter(Boolean);
    if (skills.length) parts.push(`Skills: ${skills.join(', ')}`);

    for (const exp of resume.experiences || []) {
      parts.push(
        `Experiencia: ${exp.position} en ${exp.company} (${exp.startDate?.toISOString?.()?.split('T')[0] || exp.startDate} - ${exp.endDate?.toISOString?.()?.split('T')[0] || exp.endDate || 'Actual'})${exp.description ? ': ' + exp.description : ''}`,
      );
    }

    for (const edu of resume.educations || []) {
      parts.push(
        `Educación: ${edu.degree} en ${edu.institution} (${edu.startDate?.toISOString?.()?.split('T')[0] || edu.startDate} - ${edu.endDate?.toISOString?.()?.split('T')[0] || edu.endDate || 'Actual'})`,
      );
    }

    for (const proj of resume.projects || []) {
      parts.push(
        `Proyecto: ${proj.title}${proj.description ? ': ' + proj.description : ''}${proj.technologies?.length ? ' [' + proj.technologies.join(', ') + ']' : ''}`,
      );
    }

    for (const cert of resume.certificates || []) {
      parts.push(`Certificado: ${cert.title} - ${cert.issuer}`);
    }

    for (const lang of resume.languages || []) {
      parts.push(`Idioma: ${lang.name} - ${lang.level}`);
    }

    return parts.join('\n');
  }

  private async analyze(userId: number, text: string, resumeId: number | null) {
    if (!text.trim())
      throw new BadRequestException('No se pudo extraer texto del CV.');

    const prompt = `Eres un analizador de currículums experto en ATS (Applicant Tracking Systems) y reclutamiento tecnológico.

Analiza el siguiente CV y devuelve un JSON EXACTO con este esquema (sin markdown, solo el JSON puro):

{
  "score": numero_del_1_al_100,
  "atsScore": numero_del_1_al_100,
  "strengths": ["fortaleza1", "fortaleza2"],
  "weaknesses": ["debilidad1", "debilidad2"],
  "missingSkills": ["skill_faltante1", "skill_faltante2"],
  "recommendedRoles": ["rol_recomendado1", "rol_recomendado2"],
  "recommendations": ["recomendacion1", "recomendacion2"]
}

- score: Calidad general del CV (contenido, formato, logros).
- atsScore: Qué tan optimizado está para pasar filtros ATS.
- strengths: Fortalezas clave del candidato.
- weaknesses: Debilidades o áreas de mejora.
- missingSkills: Habilidades importantes que le faltan para el mercado laboral.
- recommendedRoles: Roles laborales que mejor se ajustan a su perfil.
- recommendations: Recomendaciones accionables para mejorar el CV.

CV a analizar:
---
${text}
---`;

    let analysisData: any;
    try {
      const groqResponse = await this.groq.chat([
        { role: 'user', content: prompt },
      ]);
      const cleaned = groqResponse.content
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
      analysisData = JSON.parse(cleaned);
    } catch {
      throw new BadRequestException('Error al analizar el CV con IA');
    }

    const analysis = await this.prisma.resumeAnalysis.create({
      data: {
        userId,
        resumeId: resumeId ?? undefined,
        score: analysisData.score ?? 0,
        atsScore: analysisData.atsScore ?? 0,
        strengths: analysisData.strengths || [],
        weaknesses: analysisData.weaknesses || [],
        missingSkills: analysisData.missingSkills || [],
        recommendedRoles: analysisData.recommendedRoles || [],
        recommendations: analysisData.recommendations || [],
      },
    });

    return analysis;
  }
}
