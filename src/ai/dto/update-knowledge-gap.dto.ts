import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateKnowledgeGapDto {
  @ApiPropertyOptional({
    description: 'Estado del knowledge gap',
    example: 'IN_PROGRESS',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'Nivel de confianza del gap detectado, entre 0 y 1',
    example: 0.75,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence?: number;

  @ApiPropertyOptional({
    description: 'Evidencias asociadas al gap',
    example: ['memory:64f1a2b3c4d5e6f789012345', 'messages:token:derivada'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  evidence?: string[];
}
