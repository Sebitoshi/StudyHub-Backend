import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { AcademicRiskModule } from '../academic-risk/academic-risk.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AcademicRiskModule, AiModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
