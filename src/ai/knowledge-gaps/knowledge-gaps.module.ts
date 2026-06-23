import { Module } from '@nestjs/common';
import { KnowledgeGapsService } from './knowledge-gaps.service';
import { KnowledgeGapsRepository } from './knowledge-gaps.repository';
import { mongoProviders } from '../mongo.provider';
import { MemoryModule } from '../memory/memory.module';

@Module({
  imports: [MemoryModule],
  providers: [...mongoProviders, KnowledgeGapsService, KnowledgeGapsRepository],
  exports: [KnowledgeGapsService],
})
export class KnowledgeGapsModule {}
