import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class GenerateQuizDto {
  @ApiPropertyOptional({
    description: 'Tema del quiz. Si se omite, se usan tus brechas de conocimiento o temas recientes de tus conversaciones.',
    example: 'Funciones lineales',
  })
  @IsOptional()
  @IsString()
  topic?: string;

  @ApiPropertyOptional({
    description: 'Dificultad: BEGINNER, INTERMEDIATE o ADVANCED',
    example: 'INTERMEDIATE',
  })
  @IsOptional()
  @IsString()
  difficulty?: string;

  @ApiPropertyOptional({ description: 'Cantidad de preguntas (3-15)', example: 8 })
  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(15)
  count?: number;

  @ApiPropertyOptional({
    description:
      'Texto del material de estudio (por ejemplo, el extraído de un PDF subido). Si viene, el quiz/simulacro se basa en este contenido.',
  })
  @IsOptional()
  @IsString()
  material?: string;
}
