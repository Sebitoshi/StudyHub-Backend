import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req, Res } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CalendarService } from './calendar.service';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';
import type { Request, Response } from 'express';

@ApiTags('Calendar')
@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get('events')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener eventos en rango de fechas' })
  getEvents(
    @Req() req: Request,
    @Query('start') start: string,
    @Query('end') end: string,
  ) {
    const user = req.user as { id: number };
    const defaultStart = start || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const defaultEnd = end || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString();
    return this.calendarService.getEvents(user.id, defaultStart, defaultEnd);
  }

  @Get('exams/upcoming')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener próximos exámenes (30 días)' })
  getUpcomingExams(@Req() req: Request) {
    const user = req.user as { id: number };
    return this.calendarService.getUpcomingExams(user.id);
  }

  @Post('events')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear un evento' })
  createEvent(@Req() req: Request, @Body() dto: CreateCalendarEventDto) {
    const user = req.user as { id: number };
    return this.calendarService.createEvent(user.id, dto);
  }

  @Patch('events/:id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Editar un evento' })
  updateEvent(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateCalendarEventDto,
  ) {
    const user = req.user as { id: number };
    return this.calendarService.updateEvent(user.id, Number(id), dto);
  }

  @Delete('events/:id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Eliminar un evento' })
  deleteEvent(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as { id: number };
    return this.calendarService.deleteEvent(user.id, Number(id));
  }

  @Get('google/connect')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener URL de conexión con Google Calendar' })
  async googleConnect(@Req() req: Request) {
    const user = req.user as { id: number };
    return this.calendarService.getGoogleAuthUrl(user.id);
  }

  @Get('google/callback')
  @ApiOperation({ summary: 'Callback de Google Calendar OAuth' })
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const userId = Number(state);
    await this.calendarService.handleGoogleCallback(userId, code);
    const frontendUrl = process.env.FRONTEND_URL || 'https://studyhub-smoky.vercel.app';
    return res.redirect(`${frontendUrl}/agenda?google=connected`);
  }

  @Post('google/sync')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Sincronizar eventos con Google Calendar' })
  syncFromGoogle(@Req() req: Request) {
    const user = req.user as { id: number };
    return this.calendarService.syncFromGoogle(user.id);
  }

  @Delete('google/disconnect')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Desconectar Google Calendar' })
  disconnectGoogle(@Req() req: Request) {
    const user = req.user as { id: number };
    return this.calendarService.disconnectGoogle(user.id);
  }

  @Get('google/status')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verificar si Google Calendar está conectado' })
  async googleStatus(@Req() req: Request) {
    const user = req.user as { id: number };
    const connected = await this.calendarService.isGoogleConnected(user.id);
    return { connected };
  }
}
