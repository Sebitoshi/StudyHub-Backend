import { PartialType } from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateProfessionalProfileDto } from './create-professional-profile.dto';

export class UpdateProfessionalProfileDto extends PartialType(
  CreateProfessionalProfileDto,
) {}
