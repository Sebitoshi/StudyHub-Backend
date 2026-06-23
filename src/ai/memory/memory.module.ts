import { Module } from '@nestjs/common';
import { MemoryService } from './memory.service';
import { MemoryRepository } from './memory.repository';
import { mongoProviders } from '../mongo.provider';

@Module({
  providers: [...mongoProviders, MemoryService, MemoryRepository],
  exports: [MemoryService, MemoryRepository],
})
export class MemoryModule {}
