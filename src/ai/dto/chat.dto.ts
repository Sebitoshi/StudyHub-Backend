import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { CHAT_DEPTH_VALUES } from '../context/chat-depth';

export class ChatDto {
  @ApiPropertyOptional({
    description: 'ID de la conversación existente (ObjectId de MongoDB). Si se omite, se usa o crea una conversación activa.',
    example: '64f1a2b3c4d5e6f789012345',
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
    description:
      'Apunte concreto que el profesor debe leer completo (id de Postgres). Si se omite, se detecta por el título mencionado en el mensaje.',
    example: 12,
  })
  @IsOptional()
  @IsInt()
  noteId?: number;

  @ApiPropertyOptional({
    description:
      'Leer también las imágenes del apunte con visión. Solo se activa cuando el estudiante lo pide: cada imagen consume tokens.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  includeImages?: boolean;

  @ApiPropertyOptional({
    description:
      'Leer el texto de los PDFs del apunte (recortado a un presupuesto de caracteres). Solo se activa cuando el estudiante lo pide.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  includeFiles?: boolean;

  @ApiProperty({
    description: 'Mensaje del usuario para el asistente IA',
    example: 'Explícame la regla de la cadena con un ejemplo corto.',
  })
  @IsString()
  message: string;
}
