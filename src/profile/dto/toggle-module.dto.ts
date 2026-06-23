import { IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ToggleModuleDto {
  @ApiProperty({ description: 'ID del módulo', example: 1 })
  @IsInt()
  moduleId: number;
}
