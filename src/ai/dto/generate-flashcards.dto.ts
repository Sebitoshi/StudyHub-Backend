import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class GenerateFlashcardsDto {
  @ApiPropertyOptional({
    description:
      'Tema de las flashcards. Si se omite, se usan tus brechas de conocimiento o los temas recientes de tus conversaciones.',
    example: 'Funciones lineales',
  })
  @IsOptional()
  @IsString()
  topic?: string;

  @ApiPropertyOptional({
    description: 'Materia a la que pertenecen las tarjetas (opcional)',
    example: 'Matemáticas',
  })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({ description: 'Cantidad de tarjetas (3-20)', example: 10 })
  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(20)
  count?: number;

  @ApiPropertyOptional({
    description:
      'Texto del material de estudio (por ejemplo, el extraído de un PDF subido). Si viene, las tarjetas se basan en este contenido.',
  })
  @IsOptional()
  @IsString()
  material?: string;
}
