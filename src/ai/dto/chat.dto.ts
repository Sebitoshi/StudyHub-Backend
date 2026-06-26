import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ChatDto {
  @ApiPropertyOptional({
    description: 'ID de la conversación existente (ObjectId de MongoDB). Si se omite, se usa o crea una conversación activa.',
    example: '64f1a2b3c4d5e6f789012345',
  })
  @IsOptional()
  @IsString()
  conversationId?: string;

  @ApiPropertyOptional({
    description: 'ID del perfil de profesor IA que responderá el mensaje',
    example: 'default-teacher',
  })
  @IsOptional()
  @IsString()
  teacherId?: string;

  @ApiProperty({
    description: 'Mensaje del usuario para el asistente IA',
    example: 'Explícame la regla de la cadena con un ejemplo corto.',
  })
  @IsString()
  message: string;
}
