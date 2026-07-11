import {
  IsDateString,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePersonalInfoDto {
  @ApiPropertyOptional({ description: 'Nombre del usuario', example: 'Juan' })
  @IsOptional()
  @IsString()
  nombre?: string;

  @ApiPropertyOptional({ description: 'Apellido del usuario', example: 'Pérez' })
  @IsOptional()
  @IsString()
  apellido?: string;

  @ApiPropertyOptional({ description: 'URL de la foto de perfil', example: 'https://example.com/foto.jpg' })
  @IsOptional()
  @IsString()
  foto?: string;

  @ApiPropertyOptional({ description: 'URL del banner de perfil', example: 'https://example.com/banner.jpg' })
  @IsOptional()
  @IsString()
  banner?: string;

  @ApiPropertyOptional({ description: 'Ciudad de residencia', example: 'Buenos Aires' })
  @IsOptional()
  @IsString()
  ciudad?: string;

  @ApiPropertyOptional({ description: 'País de residencia', example: 'Argentina' })
  @IsOptional()
  @IsString()
  pais?: string;

  @ApiPropertyOptional({ description: 'Fecha de nacimiento', example: '2000-01-15' })
  @IsOptional()
  @IsDateString()
  fechaNacimiento?: string;

  @ApiPropertyOptional({ description: 'Biografía del usuario', example: 'Desarrollador full stack...' })
  @IsOptional()
  @IsString()
  biografia?: string;

  @ApiPropertyOptional({ description: 'Usuario de GitHub', example: 'juanperez' })
  @IsOptional()
  @IsString()
  github?: string;

  @ApiPropertyOptional({ description: 'Perfil de LinkedIn', example: 'https://linkedin.com/in/juanperez' })
  @IsOptional()
  @IsString()
  linkedin?: string;

  @ApiPropertyOptional({ description: 'URL del portafolio', example: 'https://juanperez.dev' })
  @IsOptional()
  @IsString()
  portafolio?: string;

  @ApiPropertyOptional({ description: 'URL de la página personal', example: 'https://juanperez.com' })
  @IsOptional()
  @IsString()
  paginaPersonal?: string;
}
