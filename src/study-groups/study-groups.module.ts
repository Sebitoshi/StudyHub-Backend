import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';
import { StudyGroupsController } from './study-groups.controller';
import { StudyGroupsService } from './study-groups.service';
import { GroupRecommendationService } from './group-recommendation.service';

@Module({
  imports: [PrismaModule, AiModule],
  controllers: [StudyGroupsController],
  providers: [StudyGroupsService, GroupRecommendationService],
  exports: [StudyGroupsService],
})
export class StudyGroupsModule {}
