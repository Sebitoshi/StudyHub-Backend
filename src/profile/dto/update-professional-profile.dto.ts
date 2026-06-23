import { PartialType } from '@nestjs/mapped-types';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateProfessionalProfileDto } from './create-professional-profile.dto';

export class UpdateProfessionalProfileDto extends PartialType(
  CreateProfessionalProfileDto,
) {}
