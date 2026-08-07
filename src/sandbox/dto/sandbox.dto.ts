import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class SandboxTestDto {
  @ApiPropertyOptional({ description: 'ID del caso (cliente)', example: 't123' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ description: 'Nombre del caso', example: 'Caso 1' })
  @IsString()
  @MaxLength(120)
  label: string;

  @ApiPropertyOptional({ description: 'Entrada estándar', example: '5 3' })
  @IsOptional()
  @IsString()
  stdin?: string;

  @ApiPropertyOptional({ description: 'Salida esperada', example: '8' })
  @IsOptional()
  @IsString()
  expected?: string;
}

export class CreateSandboxExerciseDto {
  @ApiProperty({ description: 'Título del ejercicio', example: 'Suma de dos números' })
  @IsString()
  @MaxLength(160)
  title: string;

  @ApiProperty({ description: 'Lenguaje', example: 'python' })
  @IsString()
  @MaxLength(30)
  language: string;

  @ApiPropertyOptional({ description: 'Descripción', example: 'Suma dos enteros' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'Código', example: 'print(2+3)' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ description: 'Casos de prueba', type: [SandboxTestDto] })
  @IsOptional()
  @IsArray()
  tests?: SandboxTestDto[];
}

export class UpdateSandboxExerciseDto extends CreateSandboxExerciseDto {}

export class CreateSandboxAttemptDto {
  @ApiPropertyOptional({ description: 'ID del ejercicio asociado (si aplica)' })
  @IsOptional()
  @IsInt()
  exerciseId?: number;

  @ApiProperty({ description: 'Lenguaje', example: 'python' })
  @IsString()
  @MaxLength(30)
  language: string;

  @ApiPropertyOptional({ description: 'Código ejecutado', example: 'print(1)' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ description: 'Salida obtenida', example: '1' })
  @IsOptional()
  @IsString()
  output?: string;

  @ApiPropertyOptional({ description: '¿Pasó todos los casos?', example: true })
  @IsOptional()
  @IsBoolean()
  passed?: boolean;

  @ApiPropertyOptional({ description: 'Casos evaluados', example: 3 })
  @IsOptional()
  @IsInt()
  testedCases?: number;

  @ApiPropertyOptional({ description: 'Casos aprobados', example: 2 })
  @IsOptional()
  @IsInt()
  passedCases?: number;
}
