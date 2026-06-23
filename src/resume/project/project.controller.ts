import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ProjectService } from './project.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Projects')
@ApiBearerAuth()
@Controller('resume/project')
@UseGuards(AuthGuard('jwt'))
export class ProjectController {
  constructor(private readonly service: ProjectService) {}

  @Post()
  @ApiOperation({ summary: 'Agregar proyecto al CV' })
  @ApiResponse({ status: 201, description: 'Proyecto creado correctamente' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 403, description: 'El CV no pertenece al usuario autenticado' })
  @ApiResponse({ status: 404, description: 'CV no encontrado' })
  create(@CurrentUser() user: { id: number }, @Body() dto: CreateProjectDto) {
    return this.service.create(dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Listar proyectos de un CV' })
  @ApiQuery({ name: 'resumeId', type: Number, description: 'ID del CV' })
  @ApiResponse({ status: 200, description: 'Lista de proyectos del CV' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 403, description: 'El CV no pertenece al usuario autenticado' })
  @ApiResponse({ status: 404, description: 'CV no encontrado' })
  findAll(@CurrentUser() user: { id: number }, @Query('resumeId') resumeId: string) {
    return this.service.findAllByResume(Number(resumeId), user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un proyecto' })
  @ApiParam({ name: 'id', type: Number, description: 'ID del proyecto' })
  @ApiResponse({ status: 200, description: 'Proyecto encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 403, description: 'El proyecto no pertenece al usuario autenticado' })
  @ApiResponse({ status: 404, description: 'Proyecto no encontrado' })
  findOne(@CurrentUser() user: { id: number }, @Param('id') id: string) {
    return this.service.findOne(Number(id), user.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar proyecto' })
  @ApiParam({ name: 'id', type: Number, description: 'ID del proyecto' })
  @ApiResponse({ status: 200, description: 'Proyecto actualizado correctamente' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 403, description: 'El proyecto no pertenece al usuario autenticado' })
  @ApiResponse({ status: 404, description: 'Proyecto no encontrado' })
  update(@CurrentUser() user: { id: number }, @Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.service.update(Number(id), dto, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar proyecto' })
  @ApiParam({ name: 'id', type: Number, description: 'ID del proyecto' })
  @ApiResponse({ status: 200, description: 'Proyecto eliminado correctamente' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 403, description: 'El proyecto no pertenece al usuario autenticado' })
  @ApiResponse({ status: 404, description: 'Proyecto no encontrado' })
  remove(@CurrentUser() user: { id: number }, @Param('id') id: string) {
    return this.service.remove(Number(id), user.id);
  }
}
