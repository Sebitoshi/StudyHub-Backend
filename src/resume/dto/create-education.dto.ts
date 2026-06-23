import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsOptional, IsString, IsInt } from 'class-validator';

export class CreateEducationDto {
  @ApiProperty()
  @IsInt()
  resumeId: number;

  @ApiProperty()
  @IsString()
  institution: string;

  @ApiProperty()
  @IsString()
  degree: string;

  @ApiProperty()
  @IsDateString()
  startDate: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isCurrent?: boolean;
}
