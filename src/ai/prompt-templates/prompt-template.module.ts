import { Module } from '@nestjs/common';
import { PromptTemplateService } from './prompt-template.service';
import { PromptTemplateRepository } from './prompt-template.repository';
import { MongoModule } from '../mongo.module';

@Module({
  imports: [MongoModule],
  providers: [PromptTemplateService, PromptTemplateRepository],
  exports: [PromptTemplateService],
})
export class PromptTemplateModule {}
