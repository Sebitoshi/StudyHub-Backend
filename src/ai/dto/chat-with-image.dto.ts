import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Conversación con el Profesor IA a partir de una imagen ya procesada por el
 * pipeline de tres fases. La imagen no se reenvía: el cliente manda el
 * resultado de las fases 1 (contenido), 2 (prompt interno) y 3 (detalle).
 */
export class ChatWithImageDto {
  @ApiPropertyOptional({
    description: 'ID de la conversación existente. Si se omite, se usa o crea una activa.',
  })
  @IsOptional()
  @IsString()
  conversationId?: string;

  @ApiPropertyOptional({ description: 'ID del perfil de profesor IA.' })
  @IsOptional()
  @IsString()
  teacherId?: string;

  @ApiPropertyOptional({
    description: 'Pregunta o instrucción del estudiante sobre la imagen.',
    example: 'Explícame las reglas de derivación y hazme una pregunta para comprobar si entendí.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  message?: string;

  @ApiPropertyOptional({ description: 'Nombre del archivo de imagen (solo informativo).' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  filename?: string;

  @ApiProperty({
    description: 'Fase 1: contenido principal extraído de la imagen.',
    type: 'object',
    additionalProperties: true,
  })
  @IsObject()
  contenido!: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Fase 2: prompt interno construido a partir del contenido (niveles normal, alto y máximo).',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  promptInterno?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Fase 3: detalle elaborado con el prompt interno y el contenido (niveles alto y máximo).',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  detalle?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Nivel de análisis usado por el cliente (low, default, high o max).',
    example: 'default',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  nivel?: string;
}
