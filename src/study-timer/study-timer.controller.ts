import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { StudyTimerService } from './study-timer.service';
import { CreateStudySessionDto } from './dto/create-study-session.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Study Timer')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
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
}
