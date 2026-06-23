import { PartialType } from '@nestjs/swagger';
import { CreateLanguageDto } from '../../dto/create-language.dto';

export class UpdateLanguageDto extends PartialType(CreateLanguageDto) {}
