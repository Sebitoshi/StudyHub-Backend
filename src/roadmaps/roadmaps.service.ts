import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GroqService } from '../ai/groq.service';
import { LearningGoalsService } from '../ai/learning-goals/learning-goals.service';
import { GenerateRoadmapDto } from './dto/generate-roadmap.dto';
import { RoadmapTemplate } from '@prisma/client';

@Injectable()
export class RoadmapsService {
  private readonly logger = new Logger(RoadmapsService.name);

  constructor(
    private prisma: PrismaService,
    private groq: GroqService,
    private learningGoalsService: LearningGoalsService,
    @Inject('MONGO_CLIENT') private mongoClient: any,
  ) {}

  async generateRoadmap(userId: number, dto: GenerateRoadmapDto) {
    // Flujo nuevo: ruta por tema (estilo Duolingo) con plantillas reutilizables
    if (dto.topic) {
      return this.generateTopicRoadmap(userId, dto);
    }
    // Flujo legado: ruta desde un empleo / rol (CV)
    return this.generateJobRoadmap(userId, dto);
  }

  // ---------------------------------------------------------------------------
  // Ruta por tema (niveles + lecciones + quiz) con plantillas compartidas
  // ---------------------------------------------------------------------------

  private async generateTopicRoadmap(userId: number, dto: GenerateRoadmapDto) {
    const topic = (dto.topic || '').trim();
    if (!topic) {
      throw new BadRequestException(
        'El tema es obligatorio (ej: "Inglés", "Cálculo", "Programación").',
      );
    }
    const topicSlug = this.normalizeSlug(topic);
    const goal = dto.goal?.trim() || undefined;

    const existing = await this.prisma.roadmapTemplate.findUnique({
      where: { topicSlug },
    });

    // Reutilizar la plantilla guardada si otro usuario pidió lo mismo
    if (existing && !dto.regenerate) {
      await this.prisma.roadmapTemplate.update({
        where: { id: existing.id },
        data: { usedCount: { increment: 1 } },
      });
      return this.createUserRoadmapFromData(userId, topic, goal, existing);
    }

    // Generar con IA
    let roadmapData: any;
    try {
      const { data } = await this.groq.chatJson([
        { role: 'user', content: this.buildTopicPrompt(topic, goal) },
      ]);
      roadmapData = data;
    } catch (e) {
      this.logger.error('Error parsing Groq response for Topic Roadmap:', e);
      throw new BadRequestException('Error al generar el roadmap con IA');
    }

    const levels: any[] = Array.isArray(roadmapData?.levels)
      ? roadmapData.levels
      : [];
    if (!levels.length) {
      throw new BadRequestException(
        'La IA no devolvió un roadmap válido. Intenta de nuevo.',
      );
    }

    const templateData = {
      topic,
      topicSlug,
      title: roadmapData.title || `Aprender ${topic}`,
      description: roadmapData.description ?? null,
      category: roadmapData.category ?? null,
      difficulty: roadmapData.difficulty ?? null,
      estimatedHours:
        typeof roadmapData.estimatedHours === 'number'
          ? roadmapData.estimatedHours
          : null,
      totalLevels: levels.length,
      data: roadmapData,
    };

    const template = existing
      ? await this.prisma.roadmapTemplate.update({
          where: { id: existing.id },
          data: { ...templateData, usedCount: { increment: 1 } },
        })
      : await this.prisma.roadmapTemplate.create({
          data: { ...templateData, usedCount: 1 },
        });

    return this.createUserRoadmapFromData(userId, topic, goal, template);
  }

  private async createUserRoadmapFromData(
    userId: number,
    topic: string,
    goal: string | undefined,
    template: RoadmapTemplate,
  ) {
    const data = template.data as any;
    const levels: any[] = Array.isArray(data?.levels) ? data.levels : [];

    const steps: any[] = [];
    let order = 1;
    for (let i = 0; i < levels.length; i++) {
      const lessons: any[] = Array.isArray(levels[i]?.lessons)
        ? levels[i].lessons
        : [];
      for (const lesson of lessons) {
        steps.push({
          title: lesson.title,
          description: lesson.description ?? null,
          order: order++,
          skill: lesson.skill ?? lesson.title,
          skillCategory: lesson.skillCategory ?? null,
          estimatedHours:
            typeof lesson.estimatedHours === 'number'
              ? lesson.estimatedHours
              : null,
          level: i + 1,
          practice:
            Array.isArray(lesson.practice) && lesson.practice.length
              ? lesson.practice
              : undefined,
        });
      }
    }

    const roadmap = await this.prisma.roadmap.create({
      data: {
        userId,
        topic,
        sourceTemplateId: template.id,
        title: template.title,
        description: template.description,
        category: template.category,
        difficulty: template.difficulty,
        estimatedHours: template.estimatedHours,
        totalLevels: template.totalLevels,
        currentLevel: 1,
        generatedByAi: true,
        aiPrompt: { topic, goal },
        levelsMeta: levels.map((l) => ({
          title: l?.title ?? null,
          description: l?.description ?? null,
        })),
        steps: { create: steps },
      },
      include: { steps: { orderBy: { order: 'asc' } } },
    });

    for (const step of roadmap.steps) {
      await this.learningGoalsService.createGoal(
        userId,
        step.title,
        step.description || `Aprender ${step.skill} como parte de "${topic}"`,
      );
    }

    return roadmap;
  }

  private buildTopicPrompt(topic: string, goal?: string): string {
    return `Genera un plan de aprendizaje estilo Duolingo para aprender "${topic}"${
      goal ? ` con el objetivo: "${goal}"` : ''
    }.

Genera un JSON EXACTO con este esquema (sin markdown, solo el JSON puro):
{
  "title": "Aprender ${topic}",
  "description": "Descripción general del plan",
  "category": "ej: Idiomas, Matemáticas, Programación",
  "difficulty": "Principiante | Intermedio | Avanzado",
  "estimatedHours": numero_total_horas,
  "levels": [
    {
      "title": "Nivel 1 · Tema del nivel",
      "description": "Qué se domina al terminar este nivel",
      "lessons": [
        {
          "title": "Nombre de la lección",
          "description": "Qué aprenderás",
          "skill": "Habilidad/área",
          "practice": [
            { "question": "Pregunta", "options": ["a", "b", "c", "d"], "correctIndex": 0, "explanation": "Por qué es correcta" }
          ]
        }
      ]
    }
  ]
}

Reglas:
- Entre 5 y 8 niveles, progresivos y dependientes entre sí (no se puede saltar de nivel).
- Entre 3 y 5 lecciones por nivel.
- Cada lección incluye entre 2 y 3 preguntas de opción múltiple en "practice" (siempre 4 opciones, "correctIndex" es el índice 0-3 de la correcta, y una "explanation" breve).
- Todo el contenido (descripciones, preguntas y explicaciones) debe estar en español, salvo el material propio del tema (ej. el vocabulario en inglés si el tema es inglés).
- Dificultad creciente nivel a nivel.`;
  }

  private normalizeSlug(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
  }

  // ---------------------------------------------------------------------------
  // Ruta legada: desde un empleo / rol (CV)
  // ---------------------------------------------------------------------------

  private async generateJobRoadmap(userId: number, dto: GenerateRoadmapDto) {
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
      // chatJson aplica JSON mode, max_tokens amplio, reparación de JSON truncado y reintentos
      const { data } = await this.groq.chatJson([
        { role: 'user', content: prompt },
      ]);
      roadmapData = data;
    } catch (e) {
      console.error('Error parsing Groq response for Roadmap Generate:', e);
      throw new BadRequestException('Error al generar el roadmap con IA');
    }

    if (!Array.isArray(roadmapData?.steps) || !roadmapData.steps.length) {
      throw new BadRequestException(
        'La IA no devolvió un roadmap válido. Intenta de nuevo.',
      );
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

    const updated = await this.prisma.roadmapStep.update({
      where: { id: stepId },
      data: { completed: !step.completed },
    });

    // Recalcula el nivel actual del roadmap: primer nivel con pasos incompletos
    const roadmap = await this.prisma.roadmap.findUnique({
      where: { id: step.roadmapId },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
    if (roadmap) {
      const totalLevels = roadmap.totalLevels || 1;
      let currentLevel = 1;
      for (let lvl = 1; lvl <= totalLevels; lvl++) {
        const levelSteps = roadmap.steps.filter((s) => s.level === lvl);
        if (levelSteps.length === 0) continue;
        if (!levelSteps.every((s) => s.completed)) {
          currentLevel = lvl;
          break;
        }
        currentLevel = lvl + 1;
      }
      if (roadmap.currentLevel !== currentLevel) {
        await this.prisma.roadmap.update({
          where: { id: roadmap.id },
          data: { currentLevel },
        });
      }
    }

    return updated;
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
