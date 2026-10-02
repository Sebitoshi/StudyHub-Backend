import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({ description: 'Texto del mensaje', example: '¿Repasamos hoy?' })
  @IsString({ message: 'El mensaje debe ser texto' })
  @IsNotEmpty({ message: 'El mensaje no puede estar vacío' })
  @MaxLength(2000, { message: 'El mensaje es demasiado largo (máximo 2000 caracteres)' })
  content: string;
}
