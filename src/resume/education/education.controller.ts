import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { EducationService } from './education.service';
import { CreateEducationDto } from './dto/create-education.dto';
import { UpdateEducationDto } from './dto/update-education.dto';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';

@ApiTags('Education')
@ApiBearerAuth()
@Controller('resume/education')
@UseGuards(AuthGuard('jwt'))
export class EducationController {
  constructor(private readonly service: EducationService) {}

  @Post()
  @ApiOperation({ summary: 'Agregar formación educativa' })
  @ApiResponse({ status: 201, description: 'Formación creada' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  create(@CurrentUser() user: { id: number }, @Body() dto: CreateEducationDto) {
    return this.service.create(dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Listar formaciones de un CV' })
  @ApiResponse({ status: 200, description: 'Lista de formaciones' })
  findAll(@CurrentUser() user: { id: number }, @Query('resumeId') resumeId: string) {
    return this.service.findAllByResume(Number(resumeId), user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener formación educativa' })
  @ApiResponse({ status: 200, description: 'Formación encontrada' })
  @ApiResponse({ status: 404, description: 'Formación no encontrada' })
  findOne(@CurrentUser() user: { id: number }, @Param('id') id: string) {
    return this.service.findOne(Number(id), user.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar formación' })
  @ApiResponse({ status: 200, description: 'Formación actualizada' })
  @ApiResponse({ status: 404, description: 'Formación no encontrada' })
  update(@CurrentUser() user: { id: number }, @Param('id') id: string, @Body() dto: UpdateEducationDto) {
    return this.service.update(Number(id), dto, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar formación' })
  @ApiResponse({ status: 200, description: 'Formación eliminada' })
  @ApiResponse({ status: 404, description: 'Formación no encontrada' })
  remove(@CurrentUser() user: { id: number }, @Param('id') id: string) {
    return this.service.remove(Number(id), user.id);
  }
}
