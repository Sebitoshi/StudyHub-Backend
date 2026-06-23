import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Modality } from '../../common/enums';

export class CreateAcademicProfileDto {
  @ApiProperty({ description: 'Nombre de la universidad', example: 'Universidad de Buenos Aires' })
  @IsString()
  universidad: string;

  @ApiProperty({ description: 'Carrera que cursa', example: 'Ingeniería en Sistemas' })
  @IsString()
  carrera: string;

  @ApiProperty({ description: 'Facultad a la que pertenece', example: 'Facultad de Ingeniería' })
  @IsString()
  facultad: string;

  @ApiProperty({ description: 'Semestre actual', example: 3 })
  @IsInt()
  @Min(1)
  @Max(20)
  semestreActual: number;

  @ApiProperty({ description: 'Fecha de inicio de la carrera', example: '2023-03-01' })
  @IsDateString()
  fechaInicio: string;

  @ApiProperty({ description: 'Fecha estimada de graduación', example: '2027-12-15' })
  @IsDateString()
  fechaGraduacion: string;

  @ApiProperty({ description: 'Modalidad de estudio', enum: Modality, example: 'presencial' })
  @IsEnum(Modality)
  modalidad: Modality;

  @ApiPropertyOptional({ description: 'Promedio general', example: 85 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  promedio?: number;

  @ApiPropertyOptional({ description: 'Materias favoritas', example: ['Álgebra', 'Programación'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  materiasFav?: string[];

  @ApiPropertyOptional({ description: 'Materias difíciles', example: ['Física', 'Química'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  materiasDificil?: string[];
}
