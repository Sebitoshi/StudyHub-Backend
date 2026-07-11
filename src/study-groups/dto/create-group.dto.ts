import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';

export class CreateGroupDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  subjectId?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  subjectName?: string;

  @ApiProperty({ required: false, default: 20 })
  @IsOptional()
  @IsNumber()
  @Min(2)
  @Max(100)
  maxMembers?: number;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiProperty({ required: false, description: 'PIN de 4 dígitos para grupos privados' })
  @IsOptional()
  @IsString()
  password?: string;
}
