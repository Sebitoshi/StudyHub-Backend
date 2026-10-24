import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const NOTE_ASSISTANT_ACTIONS = [
  'draft',
  'continue',
  'improve',
  'summarize',
  'outline',
] as const;

export type NoteAssistantAction = (typeof NOTE_ASSISTANT_ACTIONS)[number];

export class NoteAssistantDto {
  @ApiProperty({
    description: 'Acción del asistente',
    enum: NOTE_ASSISTANT_ACTIONS,
    example: 'improve',
  })
  @IsIn(NOTE_ASSISTANT_ACTIONS)
  action: NoteAssistantAction;

  @ApiPropertyOptional({
    description: 'Título actual del apunte (también sirve de tema para el borrador)',
    example: 'Límites y continuidad',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({
    description: 'Contenido actual del apunte en Markdown',
    example: '## Idea general\nUna función es continua si...',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50_000)
  content?: string;

  @ApiPropertyOptional({
    description: 'Indicación libre del estudiante para orientar la propuesta',
    example: 'Incluye un ejemplo con límites laterales',
  })
  @IsOptional()
  @IsString()
  @MaxLength(600)
  instruction?: string;
}
