import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateNoteDto {
  @ApiProperty({ description: 'Título de la nota' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Contenido de la nota' })
  @IsString()
  content: string;

  @ApiPropertyOptional({ description: 'Nota fijada' })
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;
}
