import { PartialType } from '@nestjs/mapped-types';
import { CreateLanguageDto } from '../../dto/create-language.dto';

export class UpdateLanguageDto extends PartialType(CreateLanguageDto) {}
