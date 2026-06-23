import { IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddObjectiveDto {
  @ApiProperty({ description: 'ID del objetivo', example: 1 })
  @IsInt()
  objectiveId: number;
}
