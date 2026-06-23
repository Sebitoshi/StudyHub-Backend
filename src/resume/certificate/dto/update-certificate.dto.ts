import { PartialType } from '@nestjs/swagger';
import { CreateCertificateDto } from '../../dto/create-certificate.dto';

export class UpdateCertificateDto extends PartialType(CreateCertificateDto) {}
