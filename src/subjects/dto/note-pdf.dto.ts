import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class NotePdfDto {
  @ApiProperty({
    description: 'Id del PDF subido para el apunte (POST /media/notes/files/.../complete)',
    example: '6712ab34cd56ef7890123456',
  })
  @IsString()
  @Matches(/^[a-f0-9]{24}$/i, { message: 'El PDF indicado no es válido.' })
  fileId: string;

  @ApiPropertyOptional({
    description: 'Tema o título del apunte a generar (si se omite se deduce del PDF)',
    example: 'Límites y continuidad',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({
    description: 'Indicación libre para orientar el apunte',
    example: 'Enfócalo en ejercicios resueltos',
  })
  @IsOptional()
  @IsString()
  @MaxLength(600)
  instruction?: string;
}
