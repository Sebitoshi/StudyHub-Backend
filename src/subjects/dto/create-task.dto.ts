import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskPriority } from '../../common/enums';

export class CreateTaskDto {
  @ApiProperty({ description: 'Título de la tarea' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ description: 'Descripción de la tarea' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: TaskPriority, description: 'Prioridad' })
  @IsEnum(TaskPriority)
  priority: TaskPriority;

  @ApiProperty({ description: 'Fecha límite' })
  @IsDateString()
  dueDate: string;
}
