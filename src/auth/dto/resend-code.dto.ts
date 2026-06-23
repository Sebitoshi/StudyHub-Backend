import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResendCodeDto {
  @ApiProperty({ description: 'Correo electrónico del usuario', example: 'juan@example.com' })
  @IsEmail()
  email: string;
}
