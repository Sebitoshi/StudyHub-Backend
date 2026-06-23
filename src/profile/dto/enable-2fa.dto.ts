import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class Enable2faDto {
  @ApiProperty({ description: 'Secreto para 2FA', example: 'JBSWY3DPEHPK3PXP' })
  @IsString()
  secret: string;
}
