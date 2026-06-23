import { Module } from '@nestjs/common';
import { TeacherProfileService } from './teacher-profile.service';
import { TeacherProfileRepository } from './teacher-profile.repository';
import { mongoProviders } from '../mongo.provider';

@Module({
  providers: [...mongoProviders, TeacherProfileService, TeacherProfileRepository],
  exports: [TeacherProfileService],
})
export class TeacherProfileModule {}
