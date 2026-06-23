import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { CertificateService } from './certificate.service';
import { CreateCertificateDto } from '../dto/create-certificate.dto';
import { UpdateCertificateDto } from './dto/update-certificate.dto';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Certificates')
@ApiBearerAuth()
@Controller('resume/certificate')
@UseGuards(AuthGuard('jwt'))
export class CertificateController {
  constructor(private readonly service: CertificateService) {}

  @Post()
  @ApiOperation({ summary: 'Crear certificado para un CV' })
  create(@CurrentUser() user: { id: number }, @Body() dto: CreateCertificateDto) {
    return this.service.create(dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Listar certificados de un CV' })
  findAll(@CurrentUser() user: { id: number }, @Query('resumeId') resumeId: string) {
    return this.service.findAllByResume(Number(resumeId), user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un certificado' })
  findOne(@CurrentUser() user: { id: number }, @Param('id') id: string) {
    return this.service.findOne(Number(id), user.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar un certificado' })
  update(@CurrentUser() user: { id: number }, @Param('id') id: string, @Body() dto: UpdateCertificateDto) {
    return this.service.update(Number(id), dto, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un certificado' })
  remove(@CurrentUser() user: { id: number }, @Param('id') id: string) {
    return this.service.remove(Number(id), user.id);
  }
}
