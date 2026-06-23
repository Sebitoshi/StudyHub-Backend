import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSubjectDto {
  @ApiProperty({ description: 'Nombre de la materia' })
  @IsString()
  nombre: string;

  @ApiPropertyOptional({ description: 'Código de la materia' })
  @IsOptional()
  @IsString()
  codigo?: string;

  @ApiPropertyOptional({ description: 'Nombre del profesor' })
  @IsOptional()
  @IsString()
  profesor?: string;

  @ApiPropertyOptional({ description: 'Salón de clase' })
  @IsOptional()
  @IsString()
  salon?: string;

  @ApiPropertyOptional({ description: 'Número de créditos' })
  @IsOptional()
  @IsInt()
  @Min(0)
  creditos?: number;

  @ApiProperty({ description: 'Color hexadecimal (ej: #FF5733)' })
  @IsString()
  color: string;

  @ApiPropertyOptional({ description: 'Descripción de la materia' })
  @IsOptional()
  @IsString()
  descripcion?: string;
}
