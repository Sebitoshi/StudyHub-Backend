import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSubjectDto {
  @ApiProperty({ description: 'Nombre de la materia', example: 'Cálculo diferencial' })
  @IsString()
  nombre: string;

  @ApiPropertyOptional({ description: 'Código de la materia', example: 'MAT-101' })
  @IsOptional()
  @IsString()
  codigo?: string;

  @ApiPropertyOptional({ description: 'Nombre del profesor', example: 'Dra. Laura Gómez' })
  @IsOptional()
  @IsString()
  profesor?: string;

  @ApiPropertyOptional({ description: 'Salón de clase', example: 'B-301' })
  @IsOptional()
  @IsString()
  salon?: string;

  @ApiPropertyOptional({ description: 'Número de créditos', example: 3 })
  @IsOptional()
  @IsInt()
  @Min(0)
  creditos?: number;

  @ApiProperty({ description: 'Color hexadecimal (ej: #FF5733)', example: '#3B82F6' })
  @IsString()
  color: string;

  @ApiPropertyOptional({ description: 'Descripción de la materia', example: 'Fundamentos de límites, derivadas y aplicaciones.' })
  @IsOptional()
  @IsString()
  descripcion?: string;
}
