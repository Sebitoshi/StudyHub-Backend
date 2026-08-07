import { Controller, Post, Get, Delete, Body, UseGuards, Request } from '@nestjs/common';
import { StudyTimerService } from './study-timer.service';
import { CreateStudySessionDto } from './dto/create-study-session.dto';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';

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
  @ApiOperation({ summary: 'Get the study session history for the current user' })
  getSessions(@Request() req: any) {
    return this.studyTimerService.getSessions(req.user.id);
  }

  @Delete('sessions')
  @ApiOperation({ summary: 'Clear the study session history for the current user' })
  clearSessions(@Request() req: any) {
    return this.studyTimerService.clearSessions(req.user.id);
  }
}
