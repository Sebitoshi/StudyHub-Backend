import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateResumeExperienceDto } from './create-experience.dto';
import { CreateEducationDto } from './create-education.dto';
import { CreateResumeProjectDto } from './create-project.dto';
import { CreateCertificateDto } from './create-certificate.dto';
import { CreateLanguageDto } from './create-language.dto';

export class CreateResumeDto {
  @ApiProperty({ description: 'ID del usuario propietario del CV', example: 1 })
  @IsNumber()
  userId: number;

  @ApiProperty({ description: 'Título profesional del CV', example: 'Desarrollador Backend Junior', required: false })
  @IsOptional()
  @IsString()
  titulo?: string;

  @ApiProperty({
    description: 'Resumen profesional',
    example: 'Desarrollador enfocado en APIs con NestJS, PostgreSQL y buenas prácticas de backend.',
    required: false,
  })
  @IsOptional()
  @IsString()
  resumen?: string;

  @ApiProperty({ description: 'Experiencias laborales', type: [CreateResumeExperienceDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateResumeExperienceDto)
  experiences?: CreateResumeExperienceDto[];

  @ApiProperty({ description: 'Slug público del CV', example: 'juan-perez-backend', required: false })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiProperty({ description: 'Formación académica', type: [CreateEducationDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateEducationDto)
  educations?: CreateEducationDto[];

  @ApiProperty({ description: 'Proyectos destacados', type: [CreateResumeProjectDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateResumeProjectDto)
  projects?: CreateResumeProjectDto[];

  @ApiProperty({ description: 'Certificaciones', type: [CreateCertificateDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCertificateDto)
  certificates?: CreateCertificateDto[];

  @ApiProperty({ description: 'Idiomas', type: [CreateLanguageDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateLanguageDto)
  languages?: CreateLanguageDto[];
}
