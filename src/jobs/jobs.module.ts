import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { JobSyncService } from './job-sync.service';
import { JobSearchService } from './job-search.service';
import { JobCrawlerService } from './job-crawler.service';
import { JobDiscoveryService } from './job-discovery.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [PrismaModule, AiModule, ConfigModule],
  controllers: [JobsController],
  providers: [JobsService, JobSyncService, JobSearchService, JobCrawlerService, JobDiscoveryService],
  exports: [JobsService],
})
export class JobsModule {}
