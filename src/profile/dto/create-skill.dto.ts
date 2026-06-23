import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSkillDto {
  @ApiProperty({ description: 'Nombre de la habilidad', example: 'TypeScript' })
  @IsString()
  nombre: string;
}
