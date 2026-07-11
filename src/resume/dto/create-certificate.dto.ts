import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsDateString, IsInt } from 'class-validator';

export class CreateCertificateDto {
  @ApiProperty({ description: 'ID del CV al que pertenece el certificado', example: 1, required: false })
  @IsOptional()
  @IsInt()
  resumeId?: number;

  @ApiProperty({ description: 'Nombre del certificado', example: 'AWS Cloud Practitioner' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Entidad emisora del certificado', example: 'Amazon Web Services' })
  @IsString()
  issuer: string;

  @ApiProperty({ description: 'Fecha de emisión del certificado', example: '2025-09-15', required: false })
  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @ApiProperty({
    description: 'URL de validación de la credencial',
    example: 'https://www.credly.com/badges/example',
    required: false,
  })
  @IsOptional()
  @IsString()
  credentialUrl?: string;
}
