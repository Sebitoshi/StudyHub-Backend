import { PartialType } from '@nestjs/mapped-types';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateAcademicProfileDto } from './create-academic-profile.dto';

export class UpdateAcademicProfileDto extends PartialType(
  CreateAcademicProfileDto,
) {}
