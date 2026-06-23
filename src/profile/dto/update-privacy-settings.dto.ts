import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePrivacySettingsDto {
  @ApiPropertyOptional({ description: 'Perfil público', example: true })
  @IsOptional()
  @IsBoolean()
  publicProfile?: boolean;

  @ApiPropertyOptional({ description: 'Mostrar habilidades', example: true })
  @IsOptional()
  @IsBoolean()
  showSkills?: boolean;

  @ApiPropertyOptional({ description: 'Mostrar CV', example: false })
  @IsOptional()
  @IsBoolean()
  showCV?: boolean;
}
