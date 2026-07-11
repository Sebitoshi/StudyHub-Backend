import { Module } from '@nestjs/common';
import { TeacherProfileService } from './teacher-profile.service';
import { TeacherProfileRepository } from './teacher-profile.repository';
import { MongoModule } from '../mongo.module';

@Module({
  imports: [MongoModule],
  providers: [TeacherProfileService, TeacherProfileRepository],
  exports: [TeacherProfileService],
})
export class TeacherProfileModule {}
