import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class UpdateLearningGoalDto {
  @ApiPropertyOptional({ example: 'Aprobar Física I con nota mínima 4.0' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  title?: string;

  @ApiPropertyOptional({ example: 'Enfocarme en ejercicios de dinámica' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '2026-08-01' })
  @IsOptional()
  @IsDateString()
  targetDate?: string;

  @ApiPropertyOptional({ example: 65, description: 'Progreso manual entre 0 y 100' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  progress?: number;

  @ApiPropertyOptional({ example: 'active', enum: ['active', 'completed', 'paused'] })
  @IsOptional()
  @IsString()
  status?: string;
}
