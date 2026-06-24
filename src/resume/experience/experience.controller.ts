import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ExperienceService } from './experience.service';
import { CreateExperienceDto } from './dto/create-experience.dto';
import { UpdateExperienceDto } from './dto/update-experience.dto';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';

@ApiTags('Experience')
@ApiBearerAuth()
@Controller('resume/experience')
@UseGuards(AuthGuard('jwt'))
export class ExperienceController {
  constructor(private readonly service: ExperienceService) {}

  @Post()
  @ApiOperation({ summary: 'Agregar experiencia laboral' })
  @ApiResponse({ status: 201, description: 'Experiencia creada' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  create(@CurrentUser() user: { id: number }, @Body() dto: CreateExperienceDto) {
    return this.service.create(dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Listar experiencias de un CV' })
  @ApiResponse({ status: 200, description: 'Lista de experiencias' })
  findAll(@CurrentUser() user: { id: number }, @Query('resumeId') resumeId: string) {
    return this.service.findAllByResume(Number(resumeId), user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una experiencia' })
  @ApiResponse({ status: 200, description: 'Experiencia encontrada' })
  @ApiResponse({ status: 404, description: 'Experiencia no encontrada' })
  findOne(@CurrentUser() user: { id: number }, @Param('id') id: string) {
    return this.service.findOne(Number(id), user.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar experiencia' })
  @ApiResponse({ status: 200, description: 'Experiencia actualizada' })
  @ApiResponse({ status: 404, description: 'Experiencia no encontrada' })
  update(@CurrentUser() user: { id: number }, @Param('id') id: string, @Body() dto: UpdateExperienceDto) {
    return this.service.update(Number(id), dto, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar experiencia' })
  @ApiResponse({ status: 200, description: 'Experiencia eliminada' })
  @ApiResponse({ status: 404, description: 'Experiencia no encontrada' })
  remove(@CurrentUser() user: { id: number }, @Param('id') id: string) {
    return this.service.remove(Number(id), user.id);
  }
}
