import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GroqService } from '../ai/groq.service';
import { LearningGoalsService } from '../ai/learning-goals/learning-goals.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RiskEngineService } from './risk-engine.service';
import { RiskRecommendationService } from './risk-recommendation.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class AcademicRiskService {
  private readonly logger = new Logger(AcademicRiskService.name);

  constructor(
    private prisma: PrismaService,
    private riskEngine: RiskEngineService,
    private recommendations: RiskRecommendationService,
    private learningGoals: LearningGoalsService,
    private notifications: NotificationsService,
    private groq: GroqService,
  ) {}

  async recalculate(userId: number) {
    const result = await this.riskEngine.calculateRisk(userId);
    const recs = this.recommendations.getRecommendations(
      result.level,
      result.reasons,
    );

    const risk = await this.prisma.academicRisk.create({
      data: {
        userId,
        score: result.riskScore,
        level: result.level,
        reasons: result.reasons,
      },
    });

    if (result.riskScore >= 80) {
      await this.triggerAiIntervention(userId, result);
    }

    return {
      id: risk.id,
      score: result.riskScore,
      level: result.level,
      reasons: result.reasons,
      recommendations: recs,
      details: {
        gapScore: result.gapScore,
        overdueScore: result.overdueScore,
        confidenceScore: result.confidenceScore,
        roadmapScore: result.roadmapScore,
        engagementScore: result.engagementScore,
      },
    };
  }

  private async triggerAiIntervention(
    userId: number,
    result: { riskScore: number; level: string; reasons: string[] },
  ) {
    const reasonsText = result.reasons.join(', ');

    const goal = await this.learningGoals.createGoal(
      userId,
      `Plan de recuperación - Riesgo ${result.level}`,
      `Nivel de riesgo: ${result.riskScore}/100. Motivos: ${reasonsText}. Meta generada automáticamente para retomar el ritmo académico.`,
    );

    const studyPlan = await this.generateStudyPlan(userId, reasonsText);
    const examTips = await this.generateExamTips(userId, reasonsText);

    await this.notifications.create(
      userId,
      'Riesgo académico alto — Intervención IA activada',
      `Se ha creado un plan de recuperación personalizado. Revisa tus nuevos recursos educativos.`,
      NotificationType.EXAM_ALERT,
      {
        riskScore: result.riskScore,
        learningGoalId: goal?.id,
        studyPlan,
        examTips,
      },
    );
  }

  private async generateStudyPlan(
    userId: number,
    reasonsText: string,
  ): Promise<string> {
    try {
      const response = await this.groq.chat([
        {
          role: 'user',
          content: `Genera un plan de estudio urgente de 7 días para un estudiante con riesgo académico alto. Motivos: ${reasonsText}.
          Devuelve SOLO el plan en texto plano, sin JSON, con días y actividades específicas. Máximo 200 palabras.`,
        },
      ]);
      return response.content;
    } catch {
      return 'Día 1-2: Repasa fundamentos. Día 3-4: Practica ejercicios. Día 5-6: Refuerza áreas débiles. Día 7: Evaluación.';
    }
  }

  private async generateExamTips(
    userId: number,
    reasonsText: string,
  ): Promise<string> {
    try {
      const response = await this.groq.chat([
        {
          role: 'user',
          content: `Genera 3 consejos de preparación para exámenes para un estudiante con: ${reasonsText}.
          Devuelve SOLO texto plano con los 3 consejos numerados. Máximo 150 palabras.`,
        },
      ]);
      return response.content;
    } catch {
      return '1. Repasa conceptos clave. 2. Practica con ejercicios. 3. Descansa adecuadamente.';
    }
  }

  async recalculateAll() {
    const users = await this.prisma.user.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    const results: Array<{ userId: number; score: number; level: string }> = [];
    for (const user of users) {
      try {
        const risk = await this.recalculate(user.id);
        results.push({ userId: user.id, score: risk.score, level: risk.level });
      } catch (err) {
        this.logger.warn(
          `Failed to recalculate risk for user ${user.id}: ${err}`,
        );
      }
    }

    return results;
  }

  async getLatest(userId: number) {
    return this.prisma.academicRisk.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getHistory(userId: number, limit = 20) {
    return this.prisma.academicRisk.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getBySubject(userId: number, subjectId: number) {
    return this.riskEngine.calculateSubjectRisk(userId, subjectId);
  }

  async getAllSubjectsRisk(userId: number) {
    const subjects = await this.prisma.subject.findMany({
      where: { userId },
      select: { id: true, nombre: true },
    });

    const results: Array<{
      subjectId: number;
      subjectName: string;
      riskScore: number;
      level: string;
      reasons: string[];
      gapScore: number;
      taskScore: number;
    }> = [];
    for (const subject of subjects) {
      const risk = await this.riskEngine.calculateSubjectRisk(
        userId,
        subject.id,
      );
      if (risk) results.push(risk);
    }

    results.sort((a, b) => b.riskScore - a.riskScore);
    return results;
  }
}
