import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateEducationDto {
  @ApiProperty({ description: 'ID del CV al que pertenece la formación', example: 1 })
  @IsNumber()
  resumeId: number;

  @ApiProperty({ description: 'Institución educativa', example: 'Universidad Nacional' })
  @IsString()
  institution: string;

  @ApiProperty({ description: 'Título o programa académico', example: 'Ingeniería de Sistemas' })
  @IsString()
  degree: string;

  @ApiProperty({ description: 'Fecha de inicio', example: '2022-01-15' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: 'Fecha de finalización', example: '2026-12-15', required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ description: 'Indica si la formación está en curso', example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isCurrent?: boolean;
}
