import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GroqService } from '../ai/groq.service';
import { LearningGoalsService } from '../ai/learning-goals/learning-goals.service';
import { GenerateRoadmapDto } from './dto/generate-roadmap.dto';

@Injectable()
export class RoadmapsService {
  constructor(
    private prisma: PrismaService,
    private groq: GroqService,
    private learningGoalsService: LearningGoalsService,
    @Inject('MONGO_CLIENT') private mongoClient: any,
  ) {}

  async generateRoadmap(userId: number, dto: GenerateRoadmapDto) {
    let targetRole = dto.targetRole || 'Desarrollador';
    let missingSkills = dto.missingSkills || [];

    // If jobId is provided, get the missing skills from the job match cache
    if (dto.jobId) {
      const db = this.mongoClient.db(process.env.MONGODB_DB || 'studyhub');
      const cacheCollection = db.collection('job_matches');

      const cachedMatch = await cacheCollection.findOne(
        { userId, jobId: dto.jobId },
        { sort: { createdAt: -1 } },
      );

      if (!cachedMatch) {
        throw new NotFoundException(
          'No se encontró un análisis de match para este empleo. Calcula el match primero.',
        );
      }

      missingSkills = cachedMatch.missingSkills || [];
      const job = await this.prisma.job.findUnique({
        where: { id: dto.jobId },
      });
      if (job) targetRole = job.title;
    }

    // Call Groq to generate the roadmap steps
    const skillsContext = missingSkills.length
      ? `El estudiante necesita aprender específicamente estas habilidades: ${missingSkills.join(', ')}.`
      : `El estudiante quiere convertirse en "${targetRole}". Determiná las habilidades técnicas clave necesarias y generá un roadmap completo.`;

    const prompt = `Genera un plan de estudio (Roadmap) para el rol de "${targetRole}".
${skillsContext}

Genera un JSON EXACTO con el siguiente esquema (sin markdown, solo el JSON puro):
{
  "title": "Roadmap para ${targetRole}",
  "description": "Breve descripción general",
  "category": "Programación, Diseño, etc.",
  "difficulty": "Intermedio",
  "estimatedHours": numero_total_horas,
  "steps": [
    {
      "title": "Aprender Docker Basics",
      "description": "Descripción de lo que debe aprender",
      "skill": "Docker",
      "skillCategory": "DevOps",
      "estimatedHours": numero_horas_paso
    }
  ]
}

Asegúrate de cubrir de forma estructurada y progresiva las habilidades necesarias. Cada habilidad puede dividirse en varios pasos lógicos si es complejo.`;

    let roadmapData;
    try {
      const groqResponse = await this.groq.chat([
        { role: 'user', content: prompt },
      ]);
      const cleanedJsonStr = groqResponse.content
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
      roadmapData = JSON.parse(cleanedJsonStr);
    } catch (e) {
      console.error('Error parsing Groq response for Roadmap Generate:', e);
      throw new BadRequestException('Error al generar el roadmap con IA');
    }

    // Save Roadmap to PostgreSQL (Prisma)
    const roadmap = await this.prisma.roadmap.create({
      data: {
        userId,
        title: roadmapData.title,
        description: roadmapData.description,
        category: roadmapData.category,
        difficulty: roadmapData.difficulty,
        estimatedHours: roadmapData.estimatedHours,
        generatedByAi: true,
        aiPrompt: { targetRole, missingSkills },
        steps: {
          create: roadmapData.steps.map((step: any, index: number) => ({
            title: step.title,
            description: step.description,
            order: index + 1,
            skill: step.skill,
            skillCategory: step.skillCategory,
            estimatedHours: step.estimatedHours,
          })),
        },
      },
      include: { steps: true },
    });

    // Generate Learning Goals in MongoDB for each step
    for (const step of roadmap.steps) {
      await this.learningGoalsService.createGoal(
        userId,
        step.title,
        step.description ||
          `Aprender ${step.skill} como parte del roadmap de ${targetRole}`,
      );
    }

    return roadmap;
  }

  async findAll(userId: number) {
    return this.prisma.roadmap.findMany({
      where: { userId },
      include: { steps: { orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number, userId: number) {
    const roadmap = await this.prisma.roadmap.findFirst({
      where: { id, userId },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
    if (!roadmap) throw new NotFoundException('Roadmap no encontrado');
    return roadmap;
  }

  async toggleStep(stepId: number, userId: number) {
    const step = await this.prisma.roadmapStep.findUnique({
      where: { id: stepId },
      include: { roadmap: true },
    });

    if (!step || step.roadmap.userId !== userId) {
      throw new NotFoundException('Paso no encontrado');
    }

    return this.prisma.roadmapStep.update({
      where: { id: stepId },
      data: { completed: !step.completed },
    });
  }

  async deleteRoadmap(id: number, userId: number) {
    const roadmap = await this.prisma.roadmap.findFirst({
      where: { id, userId },
    });

    if (!roadmap) throw new NotFoundException('Roadmap no encontrado');

    await this.prisma.roadmap.delete({ where: { id } });

    return { message: 'Roadmap eliminado exitosamente' };
  }
}
