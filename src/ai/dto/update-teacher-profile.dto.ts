import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateTeacherProfileDto {
  @ApiPropertyOptional({ example: 'Profesor de Biología Molecular' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  name?: string;

  @ApiPropertyOptional({ example: 'Enfoque en genética y bioquímica' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: ['biología', 'genética'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  subjects?: string[];

  @ApiPropertyOptional({ example: 'Eres un profesor especializado en biología molecular...' })
  @IsOptional()
  @IsString()
  @MinLength(20)
  systemPrompt?: string;

  @ApiPropertyOptional({ example: 'socratic' })
  @IsOptional()
  @IsString()
  teachingStyle?: string;

  @ApiPropertyOptional({ example: 'high' })
  @IsOptional()
  @IsString()
  difficultyLevel?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
