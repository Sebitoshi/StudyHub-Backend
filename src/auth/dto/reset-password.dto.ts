import { IsString, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token de restablecimiento' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ description: 'Nueva contraseña', example: 'NuevaPass123' })
  @IsString()
  @MinLength(6)
  password: string;
}
