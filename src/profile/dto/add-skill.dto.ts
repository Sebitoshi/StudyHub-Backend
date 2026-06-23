import { IsEnum, IsInt, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SkillLevel } from '../../common/enums';

export class AddSkillDto {
  @ApiProperty({ description: 'ID de la habilidad', example: 1 })
  @IsInt()
  skillId: number;

  @ApiPropertyOptional({ description: 'Nivel de habilidad', enum: SkillLevel, example: 'intermedio' })
  @IsOptional()
  @IsEnum(SkillLevel)
  nivel?: SkillLevel;
}
