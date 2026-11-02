import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
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

  @ApiProperty({
    description: 'Mensaje del usuario para el asistente IA',
    example: 'Explícame la regla de la cadena con un ejemplo corto.',
  })
  @IsString()
  message: string;
}
