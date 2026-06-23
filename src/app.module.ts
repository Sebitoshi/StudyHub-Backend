import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProfileModule } from './profile/profile.module';
import { MailModule } from './mail/mail.module';
import { SubjectsModule } from './subjects/subjects.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { GamificationModule } from './gamification/gamification.module';

@Module({
  imports: [PrismaModule, AuthModule, ProfileModule, MailModule, SubjectsModule, DashboardModule, GamificationModule],
})
export class AppModule {}
