import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateScheduleDto {
  @ApiProperty({ description: 'Día de la semana (0=Domingo, 1=Lunes...6=Sábado)' })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @ApiProperty({ description: 'Hora de inicio (HH:mm)' })
  @IsString()
  startTime: string;

  @ApiProperty({ description: 'Hora de fin (HH:mm)' })
  @IsString()
  endTime: string;

  @ApiPropertyOptional({ description: 'Salón de clase' })
  @IsOptional()
  @IsString()
  classroom?: string;
}
