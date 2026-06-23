import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateScheduleDto {
  @ApiProperty({ description: 'Día de la semana (0=Domingo, 1=Lunes...6=Sábado)', example: 1 })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @ApiProperty({ description: 'Hora de inicio (HH:mm)', example: '08:00' })
  @IsString()
  startTime: string;

  @ApiProperty({ description: 'Hora de fin (HH:mm)', example: '10:00' })
  @IsString()
  endTime: string;

  @ApiPropertyOptional({ description: 'Salón de clase', example: 'Aula 204' })
  @IsOptional()
  @IsString()
  classroom?: string;
}
