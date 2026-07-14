import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CorsMiddleware } from './common/cors.middleware';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { ResumeModule } from './resume/resume.module';
import { ProfileModule } from './profile/profile.module';
import { MailModule } from './mail/mail.module';
import { SubjectsModule } from './subjects/subjects.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { GamificationModule } from './gamification/gamification.module';
import { AiModule } from './ai/ai.module';
import { JobsModule } from './jobs/jobs.module';
import { RoadmapsModule } from './roadmaps/roadmaps.module';
import { ResumeAnalyzerModule } from './resume-analyzer/resume-analyzer.module';
import { StudyGroupsModule } from './study-groups/study-groups.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AcademicRiskModule } from './academic-risk/academic-risk.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    ProfileModule,
    MailModule,
    SubjectsModule,
    DashboardModule,
    GamificationModule,
    ResumeModule,
    AiModule,
    JobsModule,
    RoadmapsModule,
    ResumeAnalyzerModule,
    StudyGroupsModule,
    NotificationsModule,
    AcademicRiskModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorsMiddleware).forRoutes('*');
  }
}
