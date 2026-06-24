import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, IsArray } from 'class-validator';

export class GenerateRoadmapDto {
  @ApiProperty({
    required: false,
    description: 'ID de la vacante (para sacar missing skills del caché)',
  })
  @IsOptional()
  @IsNumber()
  jobId?: number;

  @ApiProperty({
    required: false,
    description: 'Rol objetivo (si no se usa jobId)',
  })
  @IsOptional()
  @IsString()
  targetRole?: string;

  @ApiProperty({
    required: false,
    description: 'Skills faltantes (si no se usa jobId)',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  missingSkills?: string[];
}
