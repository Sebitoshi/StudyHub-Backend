import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { PrismaModule } from '../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';
import { ResumeAnalyzerController } from './resume-analyzer.controller';
import { ResumeAnalyzerService } from './resume-analyzer.service';

@Module({
  imports: [
    PrismaModule,
    AiModule,
    MulterModule.register({ limits: { fileSize: 10 * 1024 * 1024 } }),
  ],
  controllers: [ResumeAnalyzerController],
  providers: [ResumeAnalyzerService],
})
export class ResumeAnalyzerModule {}
