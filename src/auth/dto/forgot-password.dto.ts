import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({ description: 'Correo electrónico del usuario', example: 'juan@example.com' })
  @IsEmail()
  email: string;
}
