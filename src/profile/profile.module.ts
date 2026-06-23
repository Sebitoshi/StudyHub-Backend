import { Module } from '@nestjs/common';
import {
  AppModulesController,
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
    AppModulesController,
  ],
  providers: [ProfileService],
})
export class ProfileModule {}
