import {
  Controller,
  Get,
  Logger,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('notifications')
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar notificaciones del usuario' })
  @ApiResponse({ status: 200, description: 'Lista de notificaciones paginada' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiQuery({ name: 'sortBy', required: false, type: String, example: 'createdAt' })
  @ApiQuery({ name: 'order', required: false, type: String, example: 'desc' })
  findAll(
    @CurrentUser() user: { id: number },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('order') order?: string,
  ) {
    return this.notificationsService.findAll(
      user.id,
      page ? Number(page) : 1,
      limit ? Number(limit) : 50,
      sortBy,
      order,
    );
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Contar no leídas' })
  @ApiResponse({ status: 200, description: 'Conteo de no leídas' })
  getUnreadCount(@CurrentUser() user: { id: number }) {
    return this.notificationsService.getUnreadCount(user.id);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Marcar como leída' })
  @ApiResponse({ status: 200, description: 'Notificación marcada como leída' })
  @ApiResponse({ status: 404, description: 'Notificación no encontrada' })
  markAsRead(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.notificationsService.markAsRead(id, user.id);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Marcar todas como leídas' })
  @ApiResponse({ status: 200, description: 'Todas marcadas como leídas' })
  markAllAsRead(@CurrentUser() user: { id: number }) {
    return this.notificationsService.markAllAsRead(user.id);
  }
}
