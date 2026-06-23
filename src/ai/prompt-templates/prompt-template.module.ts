import { Module } from '@nestjs/common';
import { PromptTemplateService } from './prompt-template.service';
import { PromptTemplateRepository } from './prompt-template.repository';
import { mongoProviders } from '../mongo.provider';

@Module({
  providers: [...mongoProviders, PromptTemplateService, PromptTemplateRepository],
  exports: [PromptTemplateService],
})
export class PromptTemplateModule {}
