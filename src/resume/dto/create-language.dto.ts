import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsInt } from 'class-validator';

export enum LanguageLevelDto {
  BASIC = 'BASIC',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED',
  NATIVE = 'NATIVE',
}

export class CreateLanguageDto {
  @ApiProperty({ description: 'ID del CV al que pertenece el idioma', example: 1 })
  @IsInt()
  resumeId: number;

  @ApiProperty({ description: 'Nombre del idioma', example: 'Inglés' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Nivel de dominio del idioma', enum: LanguageLevelDto, example: LanguageLevelDto.INTERMEDIATE })
  @IsEnum(LanguageLevelDto)
  level: LanguageLevelDto;
}
