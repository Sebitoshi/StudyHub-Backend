import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateStudySessionDto {
  @ApiProperty({ description: 'ID de la materia (opcional)', required: false })
  @IsOptional()
  @IsInt()
  subjectId?: number;

  @ApiProperty({ description: 'Duración en minutos' })
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  durationMinutes: number;

  @ApiProperty({ description: 'Técnica utilizada (ej. POMODORO_25_5)' })
  @IsNotEmpty()
  @IsString()
  technique: string;
}
