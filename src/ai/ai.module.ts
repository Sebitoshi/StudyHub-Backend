import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { GroqService } from './groq.service';
import { mongoProviders } from './mongo.provider';
import { AcademicContextService } from './context/academic-context.service';
import { PromptBuilderService } from './context/prompt-builder.service';
import { AdaptiveLearningService } from './adaptive/adaptive-learning.service';
import { SocraticService } from './adaptive/socratic.service';
import { ResourceGeneratorService } from './adaptive/resource-generator.service';
import { LearningPathService } from './adaptive/learning-path.service';
import { WeaknessPredictionService } from './adaptive/weakness-prediction.service';
import { ExamCoachService } from './adaptive/exam-coach.service';
import { RecommendationService } from './adaptive/recommendation.service';
import { StudentModelRepository } from './student-models/student-model.repository';
import { StudentModelService } from './student-models/student-model.service';
import { GeneratedResourcesRepository } from './generated-resources/generated-resources.repository';
import { GeneratedResourcesService } from './generated-resources/generated-resources.service';
import { LearningGoalsRepository } from './learning-goals/learning-goals.repository';
import { LearningGoalsService } from './learning-goals/learning-goals.service';
import { LearningPathsRepository } from './learning-paths/learning-paths.repository';
import { LearningPathsService } from './learning-paths/learning-paths.service';
import { AdaptiveSessionsRepository } from './adaptive/adaptive-sessions.repository';
import { AdaptiveSessionsService } from './adaptive/adaptive-sessions.service';
import { MemoryModule } from './memory/memory.module';
import { TeacherProfileModule } from './teacher-profiles/teacher-profile.module';
import { PromptTemplateModule } from './prompt-templates/prompt-template.module';
import { KnowledgeGapsModule } from './knowledge-gaps/knowledge-gaps.module';
import { LearningAnalyticsRepository } from './learning-analytics/learning-analytics.repository';
import { LearningAnalyticsService } from './learning-analytics/learning-analytics.service';
// import { PromptTemplateService } from './prompt-templates/prompt-template.service'; // <-- Puedes borrar esta importación también
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule, 
    MemoryModule, 
    TeacherProfileModule, 
    PromptTemplateModule, // <-- ¡Esto ya nos provee el servicio!
    KnowledgeGapsModule
  ],
  controllers: [AiController],
  providers: [
    ...mongoProviders, 
    AiService, 
    GroqService, 
    AcademicContextService, 
    PromptBuilderService, 
    // PromptTemplateService, <-- ¡BORRA ESTO DE AQUÍ!
    LearningAnalyticsService, 
    LearningAnalyticsRepository,
    AdaptiveLearningService, 
    SocraticService, 
    ResourceGeneratorService, 
    LearningPathService, 
    WeaknessPredictionService, 
    ExamCoachService, 
    RecommendationService,
    StudentModelRepository, 
    StudentModelService, 
    GeneratedResourcesRepository, 
    GeneratedResourcesService, 
    LearningGoalsRepository, 
    LearningGoalsService, 
    LearningPathsRepository, 
    LearningPathsService, 
    AdaptiveSessionsRepository, 
    AdaptiveSessionsService
  ],
  exports: [AiService],
})
export class AiModule {}