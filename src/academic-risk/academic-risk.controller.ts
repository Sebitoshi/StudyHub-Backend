import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AcademicRiskService } from './academic-risk.service';

@ApiTags('Academic Risk')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('risk')
export class AcademicRiskController {
  constructor(private readonly academicRiskService: AcademicRiskService) {}

  @Get()
  @ApiOperation({ summary: 'Último análisis de riesgo académico' })
  @ApiResponse({
    status: 200,
    description: 'Último análisis de riesgo',
    content: {
      'application/json': {
        example: {
          id: 1,
          userId: 1,
          score: 72,
          level: 'HIGH',
          reasons: {
            knowledgeGaps: { score: 25, max: 30, gapsCount: 5 },
            overdueTasks: { score: 18, max: 25, overdueCount: 3 },
            confidenceIA: { score: 12, max: 20, avgConfidence: 0.4 },
            roadmaps: { score: 10, max: 15, progress: 0.3 },
            engagement: { score: 7, max: 10, streakDays: 2 },
          },
          createdAt: '2026-06-23T10:00:00.000Z',
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Sin análisis previo' })
  getLatest(@CurrentUser() user: { id: number }) {
    return this.academicRiskService.getLatest(user.id);
  }

  @Get('history')
  @ApiOperation({ summary: 'Historial de análisis de riesgo' })
  @ApiResponse({ status: 200, description: 'Historial de análisis' })
  getHistory(@CurrentUser() user: { id: number }) {
    return this.academicRiskService.getHistory(user.id);
  }

  @Get('subjects')
  @ApiOperation({ summary: 'Riesgo por materia' })
  @ApiResponse({ status: 200, description: 'Riesgo por materia' })
  getSubjectsRisk(@CurrentUser() user: { id: number }) {
    return this.academicRiskService.getAllSubjectsRisk(user.id);
  }

  @Get('subjects/:subjectId')
  @ApiOperation({ summary: 'Riesgo de materia específica' })
  @ApiResponse({ status: 200, description: 'Riesgo de materia específica' })
  @ApiResponse({ status: 404, description: 'Materia no encontrada' })
  getSubjectRisk(
    @CurrentUser() user: { id: number },
    @Param('subjectId', ParseIntPipe) subjectId: number,
  ) {
    return this.academicRiskService.getBySubject(user.id, subjectId);
  }

  @Post('recalculate')
  @ApiOperation({ summary: 'Recalcular riesgo académico' })
  @ApiResponse({ status: 201, description: 'Riesgo recalculado exitosamente' })
  recalculate(@CurrentUser() user: { id: number }) {
    return this.academicRiskService.recalculate(user.id);
  }
}
