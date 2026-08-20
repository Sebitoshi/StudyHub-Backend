import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class ExplainAnswerDto {
  @ApiProperty({ description: 'Pregunta del quiz', example: '¿Cuál es la integral de $x^2$?' })
  @IsString()
  @IsNotEmpty()
  question: string;

  @ApiProperty({ description: 'Opciones del quiz', example: ['$x^3/3$', '$x^2$', '$2x$', '$x/2$'] })
  @IsArray()
  @IsString({ each: true })
  choices: string[];

  @ApiProperty({ description: 'Texto de la respuesta correcta', example: '$x^3/3 + C$' })
  @IsString()
  @IsNotEmpty()
  correctAnswer: string;

  @ApiProperty({ description: 'Tema o materia del quiz', example: 'Cálculo integral' })
  @IsString()
  @IsOptional()
  topic?: string = '';

  @ApiProperty({ description: 'El usuario acertó o no', example: true })
  @IsOptional()
  isCorrect?: boolean;
}
