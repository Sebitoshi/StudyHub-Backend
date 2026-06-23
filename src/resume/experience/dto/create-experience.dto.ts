import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateExperienceDto {
  @ApiProperty({ description: 'ID del CV al que pertenece la experiencia', example: 1 })
  @IsNumber()
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

  @ApiProperty({ description: 'Ubicación del empleo', example: 'Bogotá, Colombia', required: false })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({ description: 'Tipo de contrato o modalidad', example: 'Tiempo completo', required: false })
  @IsOptional()
  @IsString()
  employmentType?: string;
}
