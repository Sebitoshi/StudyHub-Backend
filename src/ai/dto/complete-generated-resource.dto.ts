import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';

export class CompleteGeneratedResourceDto {
  @ApiPropertyOptional({ description: 'Puntuación normalizada entre 0 y 1', example: 0.85 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  resultScore?: number;

  @ApiPropertyOptional({ description: 'Respuestas correctas', example: 8 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  resultCorrect?: number;

  @ApiPropertyOptional({ description: 'Total de preguntas', example: 10 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  resultTotal?: number;
}
