import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';
import { JwtModule } from '@nestjs/jwt';
import { StudyGroupsController } from './study-groups.controller';
import { StudyGroupsService } from './study-groups.service';
import { GroupRecommendationService } from './group-recommendation.service';
import { GroupChatService } from './group-chat.service';
import { GroupChatGateway } from './group-chat.gateway';
import { CloudinaryService } from './cloudinary.service';

@Module({
  imports: [
    PrismaModule, 
    AiModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'secret',
      signOptions: { expiresIn: '1d' },
    })
  ],
  controllers: [StudyGroupsController],
  providers: [
    StudyGroupsService,
    GroupRecommendationService,
    GroupChatService,
    GroupChatGateway,
    CloudinaryService
  ],
  exports: [StudyGroupsService],
})
export class StudyGroupsModule {}
