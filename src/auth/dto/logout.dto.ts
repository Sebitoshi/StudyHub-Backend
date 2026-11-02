import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class LogoutDto {
  @ApiPropertyOptional({
    description: 'Refresh token de la sesión que se quiere revocar',
  })
  @IsOptional()
  @IsString()
  refresh_token?: string;
}
