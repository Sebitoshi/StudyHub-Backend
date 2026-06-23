import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateExperienceDto } from './create-experience.dto';
import { CreateEducationDto } from './create-education.dto';
import { CreateProjectDto } from './create-project.dto';
import { CreateCertificateDto } from './create-certificate.dto';
import { CreateLanguageDto } from './create-language.dto';

export class CreateResumeDto {
  @ApiProperty()
  @IsNumber()
  userId: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  titulo?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  resumen?: string;

  @ApiProperty({ type: [CreateExperienceDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateExperienceDto)
  experiences?: CreateExperienceDto[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiProperty({ type: [CreateEducationDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateEducationDto)
  educations?: CreateEducationDto[];

  @ApiProperty({ type: [CreateProjectDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProjectDto)
  projects?: CreateProjectDto[];

  @ApiProperty({ type: [CreateCertificateDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCertificateDto)
  certificates?: CreateCertificateDto[];

  @ApiProperty({ type: [CreateLanguageDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateLanguageDto)
  languages?: CreateLanguageDto[];
}
