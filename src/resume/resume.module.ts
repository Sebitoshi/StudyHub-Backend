import { Module } from '@nestjs/common';
import { ResumeService } from './resume.service';
import { ResumeController } from './resume.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ExperienceController } from './experience/experience.controller';
import { ExperienceService } from './experience/experience.service';
import { EducationController } from './education/education.controller';
import { EducationService } from './education/education.service';
import { ProjectController } from './project/project.controller';
import { ProjectService } from './project/project.service';
import { CertificateController } from './certificate/certificate.controller';
import { CertificateService } from './certificate/certificate.service';
import { LanguageController } from './language/language.controller';
import { LanguageService } from './language/language.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    ResumeController,
    ExperienceController,
    EducationController,
    ProjectController,
    CertificateController,
    LanguageController,
  ],
  providers: [
    ResumeService,
    ExperienceService,
    EducationService,
    ProjectService,
    CertificateService,
    LanguageService,
  ],
})
export class ResumeModule {}
