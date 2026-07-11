import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RoadmapsService } from './roadmaps.service';
import { GenerateRoadmapDto } from './dto/generate-roadmap.dto';

@ApiTags('Roadmaps')
@ApiBearerAuth()
@Controller('roadmaps')
@UseGuards(AuthGuard('jwt'))
export class RoadmapsController {
  constructor(private readonly roadmapsService: RoadmapsService) {}

  @Post('generate')
  @ApiOperation({
    summary: 'Generar roadmap con IA a partir de skills faltantes',
  })
  @ApiResponse({ status: 201, description: 'Roadmap generado exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  generateRoadmap(
    @CurrentUser() user: { id: number },
    @Body() dto: GenerateRoadmapDto,
  ) {
    return this.roadmapsService.generateRoadmap(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar roadmaps del usuario' })
  @ApiResponse({ status: 200, description: 'Lista de roadmaps del usuario' })
  findAll(@CurrentUser() user: { id: number }) {
    return this.roadmapsService.findAll(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de un roadmap' })
  @ApiResponse({ status: 200, description: 'Detalle del roadmap' })
  @ApiResponse({ status: 404, description: 'Roadmap no encontrado' })
  findOne(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.roadmapsService.findOne(id, user.id);
  }

  @Patch('steps/:stepId/complete')
  @ApiOperation({ summary: 'Alternar estado de completado de un paso' })
  @ApiResponse({ status: 200, description: 'Estado del paso alternado' })
  @ApiResponse({ status: 404, description: 'Paso no encontrado' })
  toggleStep(
    @CurrentUser() user: { id: number },
    @Param('stepId', ParseIntPipe) stepId: number,
  ) {
    return this.roadmapsService.toggleStep(stepId, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un roadmap' })
  @ApiResponse({ status: 200, description: 'Roadmap eliminado exitosamente' })
  @ApiResponse({ status: 404, description: 'Roadmap no encontrado' })
  deleteRoadmap(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.roadmapsService.deleteRoadmap(id, user.id);
  }
}
