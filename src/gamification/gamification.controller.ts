import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GamificationService } from './gamification.service';

@ApiTags('Gamification')
@ApiBearerAuth()
@Controller('gamification')
@UseGuards(AuthGuard('jwt'))
export class GamificationController {
  constructor(private readonly gamificationService: GamificationService) {}

  @Get('progress')
  @ApiOperation({ summary: 'Obtener progreso de gamificación del usuario' })
  @ApiResponse({ status: 200, description: 'Progreso de gamificación' })
  getProgress(@CurrentUser() user: { id: number }) {
    return this.gamificationService.getProgress(user.id);
  }
}
