import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

/** Fase 2: recibe el contenido que la visión extrajo de la imagen. */
export class InternalPromptDto {
  @ApiProperty({
    description: 'Resultado de la fase 1 (contenido principal extraído de la imagen).',
    type: 'object',
    additionalProperties: true,
  })
  @IsObject()
  contenido!: Record<string, any>;

  @ApiPropertyOptional({ description: 'Idioma de salida.', example: 'es' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  idioma?: string;

  @ApiPropertyOptional({
    description: 'Enfoque del análisis (p. ej. "examen", "resumen", "clase").',
    example: 'examen',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  enfoque?: string;
}

/** Fase 3: recibe el prompt interno (fase 2) y el contenido (fase 1). */
export class ImageDetailDto extends InternalPromptDto {
  @ApiProperty({
    description: 'Prompt interno generado en la fase 2.',
    type: 'object',
    additionalProperties: true,
  })
  @IsObject()
  promptInterno!: Record<string, any>;
}
