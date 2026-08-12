import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  UseGuards,
  Request,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
  ParseEnumPipe,
} from '@nestjs/common';
import { StudyTimerService } from './study-timer.service';
import { CreateStudySessionDto } from './dto/create-study-session.dto';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';

export enum StudySessionPeriod {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  ALL = 'all',
}

@ApiTags('Study Timer')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('study-timer')
export class StudyTimerController {
  constructor(private readonly studyTimerService: StudyTimerService) {}

  @Post('session')
  @ApiOperation({ summary: 'Save a completed study session and earn XP' })
  saveSession(@Request() req: any, @Body() dto: CreateStudySessionDto) {
    return this.studyTimerService.saveSession(req.user.id, dto);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get total study hours for the current week' })
  getStats(@Request() req: any) {
    return this.studyTimerService.getStats(req.user.id);
  }

  @Get('sessions')
  @ApiOperation({ summary: 'Historial de sesiones, filtrable por día/semana/mes y paginado' })
  @ApiQuery({ name: 'period', enum: StudySessionPeriod, required: false, description: 'day | week | month | all' })
  @ApiQuery({ name: 'page', required: false, description: 'Página (1-based)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Sesiones por página (máx 50)' })
  getSessions(
    @Request() req: any,
    @Query('period', new DefaultValuePipe(StudySessionPeriod.ALL), new ParseEnumPipe(StudySessionPeriod))
    period: StudySessionPeriod,
    @Query('page', new DefaultValuePipe(1), new ParseIntPipe({ optional: true })) page: number,
    @Query('limit', new DefaultValuePipe(20), new ParseIntPipe({ optional: true })) limit: number,
  ) {
    return this.studyTimerService.getSessions(req.user.id, period, page, limit);
  }

  @Delete('sessions')
  @ApiOperation({ summary: 'Clear the study session history for the current user' })
  clearSessions(@Request() req: any) {
    return this.studyTimerService.clearSessions(req.user.id);
  }
}
