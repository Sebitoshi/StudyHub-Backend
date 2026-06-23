import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsOptional, IsString, IsInt } from 'class-validator';

export class CreateResumeExperienceDto {
  @ApiProperty({ description: 'ID del CV al que pertenece la experiencia', example: 1 })
  @IsInt()
  resumeId: number;

  @ApiProperty({ description: 'Nombre de la empresa', example: 'Study Hub' })
  @IsString()
  company: string;

  @ApiProperty({ description: 'Cargo desempeñado', example: 'Desarrollador Backend' })
  @IsString()
  position: string;

  @ApiProperty({
    description: 'Descripción de responsabilidades y logros',
    example: 'Diseñé APIs REST con NestJS y optimicé consultas PostgreSQL.',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Fecha de inicio', example: '2024-02-01' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: 'Fecha de finalización', example: '2025-11-30', required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ description: 'Indica si es el empleo actual', example: false, required: false })
  @IsOptional()
  @IsBoolean()
  isCurrent?: boolean;
}
