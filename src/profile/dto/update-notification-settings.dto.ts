import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateNotificationSettingsDto {
  @ApiPropertyOptional({ description: 'Notificaciones por correo habilitadas', example: true })
  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Notificaciones push habilitadas', example: false })
  @IsOptional()
  @IsBoolean()
  pushEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Recordatorios habilitados', example: true })
  @IsOptional()
  @IsBoolean()
  remindersEnabled?: boolean;
}
