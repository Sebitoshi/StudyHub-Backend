import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(userId: number, page = 1, limit = 50, sortBy?: string, order?: string) {
    const skip = (page - 1) * limit;
    const allowedSortFields = ['createdAt', 'title', 'type', 'read'];
    const sortField = sortBy && allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const sortOrder = order === 'asc' ? 'asc' : 'desc';
    const [notifications, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { [sortField]: sortOrder },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId } }),
      this.prisma.notification.count({ where: { userId, read: false } }),
    ]);
    return { notifications, total, unreadCount, page, limit };
  }

  async markAsRead(id: number, userId: number) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });
    if (!notification) return null;
    return this.prisma.notification.update({
      where: { id },
      data: { read: true },
    });
  }

  async markAllAsRead(userId: number) {
    await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    return { ok: true };
  }

  async create(
    userId: number,
    title: string,
    message: string,
    type: NotificationType,
    metadata?: any,
  ) {
    return this.prisma.notification.create({
      data: { userId, title, message, type, metadata: metadata ?? undefined },
    });
  }

  async getUnreadCount(userId: number) {
    return this.prisma.notification.count({ where: { userId, read: false } });
  }
}
