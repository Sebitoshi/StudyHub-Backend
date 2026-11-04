import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { MediaModule } from '../media/media.module';
import { SubjectsController } from './subjects.controller';
import { SubjectsService } from './subjects.service';

@Module({
  imports: [AiModule, MediaModule],
  controllers: [SubjectsController],
  providers: [SubjectsService],
})
export class SubjectsModule {}
