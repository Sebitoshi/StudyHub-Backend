import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCalendarEventDto, EventType } from './dto/create-calendar-event.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';

@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async getEvents(userId: number, start: string, end: string) {
    const startDate = new Date(start);
    const endDate = new Date(end);

    const events = await this.prisma.calendarEvent.findMany({
      where: {
        userId,
        startAt: { lte: endDate },
        endAt: { gte: startDate },
      },
      include: { subject: { select: { id: true, nombre: true, color: true } } },
      orderBy: { startAt: 'asc' },
    });

    const tasks = await this.prisma.task.findMany({
      where: {
        subject: { userId },
        dueDate: { gte: startDate, lte: endDate },
      },
      include: { subject: { select: { id: true, nombre: true, color: true } } },
      orderBy: { dueDate: 'asc' },
    });

    return {
      events,
      tasks: tasks.map(t => ({
        id: `task-${t.id}`,
        title: t.title,
        description: t.description,
        startAt: t.dueDate,
        endAt: t.dueDate,
        allDay: true,
        color: t.subject?.color || '#9ca3af',
        type: 'TASK' as const,
        subject: t.subject,
        taskStatus: t.status,
      })),
    };
  }

  async getUpcomingExams(userId: number) {
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    return this.prisma.calendarEvent.findMany({
      where: {
        userId,
        type: EventType.EXAM,
        startAt: { gte: now, lte: thirtyDays },
      },
      include: { subject: { select: { id: true, nombre: true, color: true } } },
      orderBy: { startAt: 'asc' },
    });
  }

  async createEvent(userId: number, dto: CreateCalendarEventDto) {
    const event = await this.prisma.calendarEvent.create({
      data: {
        userId,
        title: dto.title,
        description: dto.description,
        startAt: new Date(dto.startAt),
        endAt: new Date(dto.endAt),
        allDay: dto.allDay ?? false,
        color: dto.color ?? '#3b82f6',
        type: dto.type ?? EventType.EVENT,
        subjectId: dto.subjectId ?? null,
      },
      include: { subject: { select: { id: true, nombre: true, color: true } } },
    });

    if (event.googleEventId) {
      await this.syncToGoogle(userId, event);
    }

    return event;
  }

  async updateEvent(userId: number, eventId: number, dto: UpdateCalendarEventDto) {
    const existing = await this.findEventOrThrow(eventId, userId);

    const event = await this.prisma.calendarEvent.update({
      where: { id: eventId },
      data: {
        ...dto,
        startAt: dto.startAt ? new Date(dto.startAt) : undefined,
        endAt: dto.endAt ? new Date(dto.endAt) : undefined,
      },
      include: { subject: { select: { id: true, nombre: true, color: true } } },
    });

    if (existing.googleEventId) {
      await this.syncToGoogle(userId, event);
    }

    return event;
  }

  async deleteEvent(userId: number, eventId: number) {
    const existing = await this.findEventOrThrow(eventId, userId);

    if (existing.googleEventId) {
      await this.deleteFromGoogle(userId, existing.googleEventId);
    }

    await this.prisma.calendarEvent.delete({ where: { id: eventId } });
    return { message: 'Evento eliminado' };
  }

  async getGoogleAuthUrl(userId: number) {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    const redirectUri = this.config.get<string>('GOOGLE_CALENDAR_REDIRECT_URI')
      || `${this.config.get<string>('BACKEND_URL') || 'https://study-hub-backend-gablfori5-sebitasdowns-projects.vercel.app'}/calendar/google/callback`;

    const params = new URLSearchParams({
      client_id: clientId!,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/calendar',
      access_type: 'offline',
      prompt: 'consent',
      state: String(userId),
    });

    return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` };
  }

  async handleGoogleCallback(userId: number, code: string) {
    const tokenData = await this.exchangeCode(code);
    const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000);

    await this.prisma.googleCalendarToken.upsert({
      where: { userId },
      create: {
        userId,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt,
      },
      update: {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || undefined,
        expiresAt,
      },
    });

    return { message: 'Google Calendar conectado exitosamente' };
  }

  async syncToGoogle(userId: number, event: any) {
    const token = await this.getValidToken(userId);
    if (!token) return;

    const gcalEvent = {
      summary: event.title,
      description: event.description || '',
      start: event.allDay
        ? { date: event.startAt.toISOString().split('T')[0] }
        : { dateTime: event.startAt.toISOString() },
      end: event.allDay
        ? { date: event.endAt.toISOString().split('T')[0] }
        : { dateTime: event.endAt.toISOString() },
    };

    try {
      const method = event.googleEventId ? 'PUT' : 'POST';
      const url = event.googleEventId
        ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${event.googleEventId}`
        : 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(gcalEvent),
      });

      if (res.ok) {
        const data = await res.json();
        if (!event.googleEventId) {
          await this.prisma.calendarEvent.update({
            where: { id: event.id },
            data: { googleEventId: data.id },
          });
        }
      }
    } catch (err) {
      this.logger.error('Failed to sync event to Google Calendar', err);
    }
  }

  async deleteFromGoogle(userId: number, googleEventId: string) {
    const token = await this.getValidToken(userId);
    if (!token) return;

    try {
      await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${token.accessToken}` } },
      );
    } catch (err) {
      this.logger.error('Failed to delete event from Google Calendar', err);
    }
  }

  async syncFromGoogle(userId: number) {
    const token = await this.getValidToken(userId);
    if (!token) return { message: 'No hay conexión con Google Calendar' };

    try {
      const now = new Date();
      const timeMin = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const timeMax = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();

      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`,
        { headers: { Authorization: `Bearer ${token.accessToken}` } },
      );

      if (!res.ok) return { message: 'Error al sincronizar con Google Calendar', synced: 0 };

      const data = await res.json();
      const items = data.items || [];
      let synced = 0;

      for (const item of items) {
        const exists = await this.prisma.calendarEvent.findFirst({
          where: { googleEventId: item.id },
        });

        if (exists) continue;

        const start = item.start?.dateTime || item.start?.date;
        const end = item.end?.dateTime || item.end?.date;
        const allDay = !!item.start?.date;

        await this.prisma.calendarEvent.create({
          data: {
            userId,
            title: item.summary || 'Evento de Google',
            description: item.description || '',
            startAt: new Date(start),
            endAt: new Date(end),
            allDay,
            color: '#4285f4',
            type: EventType.EVENT,
            googleEventId: item.id,
          },
        });
        synced++;
      }

      return { message: `${synced} eventos sincronizados desde Google Calendar`, synced };
    } catch (err) {
      this.logger.error('Failed to sync from Google Calendar', err);
      return { message: 'Error al sincronizar', synced: 0 };
    }
  }

  async disconnectGoogle(userId: number) {
    const token = await this.prisma.googleCalendarToken.findUnique({ where: { userId } });
    if (token) {
      try {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${token.accessToken}`, {
          method: 'POST',
        });
      } catch {}
      await this.prisma.googleCalendarToken.delete({ where: { userId } });
    }
    return { message: 'Google Calendar desconectado' };
  }

  async isGoogleConnected(userId: number): Promise<boolean> {
    const token = await this.prisma.googleCalendarToken.findUnique({ where: { userId } });
    return !!token;
  }

  private async findEventOrThrow(eventId: number, userId: number) {
    const event = await this.prisma.calendarEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Evento no encontrado');
    if (event.userId !== userId) throw new ForbiddenException('No tienes acceso a este evento');
    return event;
  }

  private async exchangeCode(code: string) {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET');
    const redirectUri = this.config.get<string>('GOOGLE_CALENDAR_REDIRECT_URI')
      || `${this.config.get<string>('BACKEND_URL') || 'https://study-hub-backend-gablfori5-sebitasdowns-projects.vercel.app'}/calendar/google/callback`;

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId!,
        client_secret: clientSecret!,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });

    return res.json();
  }

  private async getValidToken(userId: number) {
    const record = await this.prisma.googleCalendarToken.findUnique({ where: { userId } });
    if (!record) return null;

    if (record.expiresAt > new Date()) return record;

    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET');

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: record.refreshToken,
        client_id: clientId!,
        client_secret: clientSecret!,
        grant_type: 'refresh_token',
      }).toString(),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000);

    await this.prisma.googleCalendarToken.update({
      where: { userId },
      data: { accessToken: data.access_token, expiresAt },
    });

    return { ...record, accessToken: data.access_token };
  }
}
