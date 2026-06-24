import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { CertificateService } from './certificate.service';
import { CreateCertificateDto } from '../dto/create-certificate.dto';
import { UpdateCertificateDto } from './dto/update-certificate.dto';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';

@ApiTags('Certificates')
@ApiBearerAuth()
@Controller('resume/certificate')
@UseGuards(AuthGuard('jwt'))
export class CertificateController {
  constructor(private readonly service: CertificateService) {}

  @Post()
  @ApiOperation({ summary: 'Crear certificado para un CV' })
  @ApiResponse({ status: 201, description: 'Certificado creado' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  create(@CurrentUser() user: { id: number }, @Body() dto: CreateCertificateDto) {
    return this.service.create(dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Listar certificados de un CV' })
  @ApiResponse({ status: 200, description: 'Lista de certificados' })
  findAll(@CurrentUser() user: { id: number }, @Query('resumeId') resumeId: string) {
    return this.service.findAllByResume(Number(resumeId), user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un certificado' })
  @ApiResponse({ status: 200, description: 'Certificado encontrado' })
  @ApiResponse({ status: 404, description: 'Certificado no encontrado' })
  findOne(@CurrentUser() user: { id: number }, @Param('id') id: string) {
    return this.service.findOne(Number(id), user.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar un certificado' })
  @ApiResponse({ status: 200, description: 'Certificado actualizado' })
  @ApiResponse({ status: 404, description: 'Certificado no encontrado' })
  update(@CurrentUser() user: { id: number }, @Param('id') id: string, @Body() dto: UpdateCertificateDto) {
    return this.service.update(Number(id), dto, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un certificado' })
  @ApiResponse({ status: 200, description: 'Certificado eliminado' })
  @ApiResponse({ status: 404, description: 'Certificado no encontrado' })
  remove(@CurrentUser() user: { id: number }, @Param('id') id: string) {
    return this.service.remove(Number(id), user.id);
  }
}
