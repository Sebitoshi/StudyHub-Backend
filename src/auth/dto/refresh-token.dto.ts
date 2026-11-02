import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh token entregado al iniciar sesión',
    example: '9f2c...',
  })
  @IsString()
  @IsNotEmpty({ message: 'El refresh token es obligatorio' })
  refresh_token: string;
}
