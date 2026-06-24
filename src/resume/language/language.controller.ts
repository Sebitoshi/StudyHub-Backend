import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { LanguageService } from './language.service';
import { CreateLanguageDto } from '../dto/create-language.dto';
import { UpdateLanguageDto } from './dto/update-language.dto';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';

@ApiTags('Languages')
@ApiBearerAuth()
@Controller('resume/language')
@UseGuards(AuthGuard('jwt'))
export class LanguageController {
  constructor(private readonly service: LanguageService) {}

  @Post()
  @ApiOperation({ summary: 'Agregar idioma al CV' })
  @ApiResponse({ status: 201, description: 'Idioma agregado' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  create(@CurrentUser() user: { id: number }, @Body() dto: CreateLanguageDto) {
    return this.service.create(dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Listar idiomas de un CV' })
  @ApiResponse({ status: 200, description: 'Lista de idiomas' })
  findAll(@CurrentUser() user: { id: number }, @Query('resumeId') resumeId: string) {
    return this.service.findAllByResume(Number(resumeId), user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un idioma' })
  @ApiResponse({ status: 200, description: 'Idioma encontrado' })
  @ApiResponse({ status: 404, description: 'Idioma no encontrado' })
  findOne(@CurrentUser() user: { id: number }, @Param('id') id: string) {
    return this.service.findOne(Number(id), user.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar idioma' })
  @ApiResponse({ status: 200, description: 'Idioma actualizado' })
  @ApiResponse({ status: 404, description: 'Idioma no encontrado' })
  update(@CurrentUser() user: { id: number }, @Param('id') id: string, @Body() dto: UpdateLanguageDto) {
    return this.service.update(Number(id), dto, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar idioma' })
  @ApiResponse({ status: 200, description: 'Idioma eliminado' })
  @ApiResponse({ status: 404, description: 'Idioma no encontrado' })
  remove(@CurrentUser() user: { id: number }, @Param('id') id: string) {
    return this.service.remove(Number(id), user.id);
  }
}
