import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { CHAT_DEPTH_VALUES } from '../context/chat-depth';

/**
 * Conversación con el Profesor IA a partir de un documento subido (PDF/DOCX/TXT).
 *
 * El backend recibe el archivo (o reusa una subida por partes ya completada con
 * `uploadId` para documentos grandes), extrae su texto y alimenta al profesor con
 * ese material. Es el equivalente del flujo de imágenes para documentos.
 */
export class ChatWithDocumentDto {
  @ApiPropertyOptional({
    description: 'ID de la conversación existente (ObjectId de MongoDB). Si se omite, se usa o crea una conversación activa.',
  })
  @IsOptional()
  @IsString()
  conversationId?: string;

  @ApiPropertyOptional({
    description: 'Ignorado: el chat ya no envía perfiles de profesor IA al modelo.',
    example: 'default-teacher',
    deprecated: true,
  })
  @IsOptional()
  @IsString()
  teacherId?: string;

  @ApiPropertyOptional({
    description:
      'Profundidad del contexto: auto (detecta la materia), low (solo chat), medium (progreso), max (apuntes de la materia) o maxpro (apuntes de todas las materias).',
    enum: CHAT_DEPTH_VALUES,
    default: 'auto',
  })
  @IsOptional()
  @IsIn(CHAT_DEPTH_VALUES)
  depth?: string;

  @ApiPropertyOptional({
    description: 'Pregunta o instrucción del estudiante sobre el documento.',
    example: 'Explícame este PDF y ayúdame a entender los conceptos clave.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  question?: string;

  @ApiPropertyOptional({
    description: 'Tema del documento (se infiere del nombre del archivo si se omite).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  topic?: string;

  @ApiPropertyOptional({
    description: 'Id de una subida por partes ya completada (para documentos grandes).',
  })
  @IsOptional()
  @IsString()
  uploadId?: string;

  @ApiPropertyOptional({
    description: 'Nombre del archivo (solo informativo).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  filename?: string;
}
