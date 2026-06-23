import { Injectable } from '@nestjs/common';
import { SocraticService } from './socratic.service';
import { ResourceGeneratorService } from './resource-generator.service';
import { LearningPathService } from './learning-path.service';
import { WeaknessPredictionService } from './weakness-prediction.service';
import { ExamCoachService } from './exam-coach.service';
import { RecommendationService } from './recommendation.service';
import { StudentModelService } from '../student-models/student-model.service';

@Injectable()
export class AdaptiveLearningService {
  constructor(
    private readonly socratic: SocraticService,
    private readonly resources: ResourceGeneratorService,
    private readonly paths: LearningPathService,
    private readonly weakness: WeaknessPredictionService,
    private readonly exam: ExamCoachService,
    private readonly rec: RecommendationService,
    private readonly studentModel: StudentModelService,
  ) {}

  analyze(userMessage: string, academicContext: any, memories: any[], analytics: any[], knowledgeGaps: any[]) {
    const model = this.studentModel.buildModel(academicContext, memories, analytics);
    const mode = this.socratic.decideMode(userMessage, model);
    const predictedWeaknesses = this.weakness.predictFromGaps(knowledgeGaps || []);

    const actions: any = {};
    if (mode === 'COACH') {
      actions.resources = this.resources.generateQuickResources(userMessage, model.academicLevel);
      actions.exam = this.exam.generateMockExam(userMessage, 5);
    }
    if (mode && mode.startsWith('SOCRATIC')) {
      actions.socraticPrompts = this.socratic.generateSocraticPrompts(userMessage, mode);
    }
    // Always suggest recommendations for top predicted weakness
    if (predictedWeaknesses && predictedWeaknesses.length) {
      actions.recommendations = this.rec.recommendResources(predictedWeaknesses[0].topic);
    }

    actions.learningPath = this.paths.createQuickPath(userMessage, 7);

    return { mode, model, predictedWeaknesses, actions };
  }
}
