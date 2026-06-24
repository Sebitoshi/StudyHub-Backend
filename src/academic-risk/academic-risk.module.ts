import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AcademicRiskController } from './academic-risk.controller';
import { AcademicRiskService } from './academic-risk.service';
import { RiskEngineService } from './risk-engine.service';
import { RiskRecommendationService } from './risk-recommendation.service';

@Module({
  imports: [PrismaModule, AiModule, NotificationsModule],
  controllers: [AcademicRiskController],
  providers: [
    AcademicRiskService,
    RiskEngineService,
    RiskRecommendationService,
  ],
})
export class AcademicRiskModule {}
