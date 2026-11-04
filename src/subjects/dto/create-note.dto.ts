import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateNoteDto {
  @ApiProperty({ description: 'Título de la nota', example: 'Resumen de derivadas' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Contenido de la nota', example: 'La derivada mide la tasa de cambio instantánea de una función.' })
  @IsString()
  content: string;

  @ApiPropertyOptional({ description: 'Nota fijada', example: true })
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @ApiPropertyOptional({
    description:
      'Ids de imágenes ya subidas (POST /media/notes/images/:uploadId/complete) para ligarlas al apunte',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageIds?: string[];
}
