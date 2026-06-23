import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class Verify2faDto {
  @ApiProperty({ description: 'Token de verificación 2FA', example: '123456' })
  @IsString()
  token: string;
}
