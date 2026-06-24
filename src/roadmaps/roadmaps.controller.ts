import {
  Body,
  Controller,
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
  @ApiOperation({ summary: 'Marcar paso de roadmap como completado' })
  @ApiResponse({ status: 200, description: 'Paso marcado como completado' })
  @ApiResponse({ status: 404, description: 'Paso no encontrado' })
  completeStep(
    @CurrentUser() user: { id: number },
    @Param('stepId', ParseIntPipe) stepId: number,
  ) {
    return this.roadmapsService.completeStep(stepId, user.id);
  }
}
