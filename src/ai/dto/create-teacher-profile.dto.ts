import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateTeacherProfileDto {
  @ApiProperty({ example: 'BIOLOGY_TEACHER' })
  @IsString()
  @MinLength(3)
  code: string;

  @ApiProperty({ example: 'Profesor de Biología' })
  @IsString()
  @MinLength(3)
  name: string;

  @ApiPropertyOptional({ example: 'Explica procesos biológicos con ejemplos visuales' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: ['biología', 'genética', 'célula'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  subjects?: string[];

  @ApiProperty({ example: 'Eres un profesor de biología: usa analogías, diagramas y ejemplos del cuerpo humano.' })
  @IsString()
  @MinLength(20)
  systemPrompt: string;

  @ApiPropertyOptional({ example: 'visual' })
  @IsOptional()
  @IsString()
  teachingStyle?: string;

  @ApiPropertyOptional({ example: 'medium' })
  @IsOptional()
  @IsString()
  difficultyLevel?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
