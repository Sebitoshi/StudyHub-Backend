import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GroupChatService {
  private readonly logger = new Logger(GroupChatService.name);

  constructor(private prisma: PrismaService) {}

  async getMessages(groupId: number, limit = 50) {
    const messages = await this.prisma.groupMessage.findMany({
      where: { groupId },
      include: {
        user: {
          select: { id: true, nombre: true, apellido: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return messages.reverse();
  }

  async saveMessage(
    groupId: number,
    userId: number,
    content?: string,
    imageUrl?: string,
  ) {
    return this.prisma.groupMessage.create({
      data: {
        groupId,
        userId,
        content,
        imageUrl,
      },
      include: {
        user: {
          select: { id: true, nombre: true, apellido: true },
        },
      },
    });
  }
}
