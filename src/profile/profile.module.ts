import { Module } from '@nestjs/common';
import {
  ObjectivesController,
  ProfileController,
  SkillsController,
} from './profile.controller';
import { ProfileService } from './profile.service';

@Module({
  controllers: [
    ProfileController,
    SkillsController,
    ObjectivesController,
  ],
  providers: [ProfileService],
})
export class ProfileModule {}
