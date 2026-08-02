import { Module } from '@nestjs/common';
import { StudyTimerController } from './study-timer.controller';
import { StudyTimerService } from './study-timer.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [StudyTimerController],
  providers: [StudyTimerService],
})
export class StudyTimerModule {}
