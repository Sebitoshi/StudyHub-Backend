import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreateResumeProjectDto {
  @ApiProperty({ description: 'Título del proyecto', example: 'Study Hub' })
  @IsString()
  title: string;

  @ApiProperty({
    description: 'Descripción breve del proyecto',
    example: 'Plataforma para organizar materias, tareas, notas y progreso académico.',
  })
  @IsString()
  description: string;

  @ApiProperty({
    description: 'URL del repositorio en GitHub',
    example: 'https://github.com/usuario/study-hub',
    required: false,
  })
  @IsOptional()
  @IsString()
  githubUrl?: string;

  @ApiProperty({
    description: 'URL pública del proyecto desplegado',
    example: 'https://study-hub.example.com',
    required: false,
  })
  @IsOptional()
  @IsString()
  liveUrl?: string;

  @ApiProperty({
    description: 'Tecnologías utilizadas',
    example: ['NestJS', 'PostgreSQL', 'React'],
    type: [String],
  })
  @IsArray()
  technologies: string[];
}
