import { IsEnum, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  Availability,
  Modality,
  ProfessionalLevel,
} from '../../common/enums';

export class CreateProfessionalProfileDto {
  @ApiProperty({ description: 'Cargo deseado por el usuario', example: 'Desarrollador Backend' })
  @IsString()
  cargoDeseado: string;

  @ApiProperty({ description: 'Nivel profesional actual', enum: ProfessionalLevel, example: 'junior' })
  @IsEnum(ProfessionalLevel)
  nivelActual: ProfessionalLevel;

  @ApiProperty({ description: 'Disponibilidad laboral', enum: Availability, example: 'tiempo_completo' })
  @IsEnum(Availability)
  disponibilidad: Availability;

  @ApiProperty({ description: 'Modalidad de trabajo deseada', enum: Modality, example: 'remoto' })
  @IsEnum(Modality)
  modalidadDeseada: Modality;
}
