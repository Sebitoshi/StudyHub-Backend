import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsInt } from 'class-validator';

export enum LanguageLevelDto {
  BASIC = 'BASIC',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED',
  NATIVE = 'NATIVE',
}

export class CreateLanguageDto {
  @ApiProperty()
  @IsInt()
  resumeId: number;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ enum: LanguageLevelDto })
  @IsEnum(LanguageLevelDto)
  level: LanguageLevelDto;
}
