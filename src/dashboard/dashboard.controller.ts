import { Controller, Get, Logger, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
@UseGuards(AuthGuard('jwt'))
export class DashboardController {
  private readonly logger = new Logger(DashboardController.name);

  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @ApiOperation({
    summary: 'Obtener resumen del dashboard',
    description:
      'Devuelve estadísticas, próximas clases del día, tareas pendientes y notas recientes en una sola llamada.',
  })
  @ApiResponse({ status: 200, description: 'Resumen del dashboard' })
  getSummary(@CurrentUser() user: { id: number }) {
    return this.dashboardService.getSummary(user.id);
  }

  @Get('leaderboard')
  @ApiOperation({
    summary: 'Obtener ranking de estudiantes',
    description:
      'Devuelve los usuarios con más racha y con más horas de estudio, más la posición del usuario actual.',
  })
  @ApiResponse({ status: 200, description: 'Ranking de estudiantes' })
  getLeaderboard(@CurrentUser() user: { id: number }) {
    return this.dashboardService.getLeaderboard(user.id);
  }
}
