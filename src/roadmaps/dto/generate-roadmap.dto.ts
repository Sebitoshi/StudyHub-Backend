import { ApiProperty } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsArray,
  IsBoolean,
} from 'class-validator';

export class GenerateRoadmapDto {
  @ApiProperty({
    required: false,
    description:
      'Tema a aprender (ej: "Inglés", "Cálculo", "Programación"). Si se envía, se usa el flujo de ruta por tema (estilo Duolingo).',
  })
  @IsOptional()
  @IsString()
  topic?: string;

  @ApiProperty({
    required: false,
    description: 'Objetivo o contexto del aprendizaje (ej: "para conversar")',
  })
  @IsOptional()
  @IsString()
  goal?: string;

  @ApiProperty({
    required: false,
    description:
      'Regenerar la ruta del tema con IA aunque ya exista una plantilla guardada',
  })
  @IsOptional()
  @IsBoolean()
  regenerate?: boolean;

  @ApiProperty({
    required: false,
    description: 'ID de la vacante (para sacar missing skills del caché)',
  })
  @IsOptional()
  @IsNumber()
  jobId?: number;

  @ApiProperty({
    required: false,
    description: 'Rol objetivo (si no se usa jobId)',
  })
  @IsOptional()
  @IsString()
  targetRole?: string;

  @ApiProperty({
    required: false,
    description: 'Skills faltantes (si no se usa jobId)',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  missingSkills?: string[];
}
