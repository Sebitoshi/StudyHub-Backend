import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateLearningGoalDto {
  @ApiProperty({ example: 'Aprobar Física I' })
  @IsString()
  @MinLength(3)
  title: string;

  @ApiPropertyOptional({ example: 'Dominar cinemática, dinámica y primer parcial' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '2026-07-15' })
  @IsOptional()
  @IsDateString()
  targetDate?: string;
}
