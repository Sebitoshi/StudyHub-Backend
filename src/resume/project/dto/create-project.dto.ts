import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateProjectDto {
  @ApiProperty()
  @IsNumber()
  resumeId: number;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  githubUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  liveUrl?: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  technologies: string[];
}
