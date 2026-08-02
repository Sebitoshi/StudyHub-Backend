import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum EventType {
  EVENT = 'EVENT',
  EXAM = 'EXAM',
}

export class CreateCalendarEventDto {
  @ApiProperty({ example: 'Examen de Cálculo' })
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ example: 'Capítulos 5-8' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: '2026-08-15T08:00:00.000Z' })
  @IsDateString()
  startAt: string;

  @ApiProperty({ example: '2026-08-15T10:00:00.000Z' })
  @IsDateString()
  endAt: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  allDay?: boolean;

  @ApiPropertyOptional({ default: '#3b82f6' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ enum: EventType, default: EventType.EVENT })
  @IsOptional()
  @IsEnum(EventType)
  type?: EventType;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  subjectId?: number;
}
