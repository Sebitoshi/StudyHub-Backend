import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskPriority } from '../../common/enums';

export class CreateTaskDto {
  @ApiProperty({ description: 'Título de la tarea', example: 'Resolver taller de límites' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ description: 'Descripción de la tarea', example: 'Completar ejercicios 1 al 10 del capítulo 2.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: TaskPriority, description: 'Prioridad', example: TaskPriority.HIGH })
  @IsEnum(TaskPriority)
  priority: TaskPriority;

  @ApiProperty({ description: 'Fecha límite', example: '2026-07-01T23:59:00.000Z' })
  @IsDateString()
  dueDate: string;
}
