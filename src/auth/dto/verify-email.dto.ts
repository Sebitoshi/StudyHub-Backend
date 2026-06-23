import { IsEmail, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyEmailDto {
  @ApiProperty({ description: 'Correo electrónico del usuario', example: 'juan@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Código de verificación de 6 dígitos', example: '123456' })
  @IsString()
  @Length(6, 6)
  code: string;
}
