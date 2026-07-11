import { Module } from '@nestjs/common';
import { MemoryService } from './memory.service';
import { MemoryRepository } from './memory.repository';
import { MongoModule } from '../mongo.module';

@Module({
  imports: [MongoModule],
  providers: [MemoryService, MemoryRepository],
  exports: [MemoryService, MemoryRepository],
})
export class MemoryModule {}
