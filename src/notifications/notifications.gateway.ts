import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  namespace: '/notifications',
  cors: { origin: '*' },
})
export class NotificationsGateway implements OnGatewayConnection {
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(private jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      let token = client.handshake.auth?.token;
      if (!token) {
        const authHeader = client.handshake.headers.authorization;
        if (authHeader) token = authHeader.split(' ')[1];
      }

      if (!token) throw new Error('No token provided');

      const payload = this.jwtService.verify(token);
      client.data.user = payload;
      client.join(`user_${payload.sub}`);
      this.logger.log(`Notifications client connected: ${client.id} (user: ${payload.sub})`);
    } catch (error) {
      this.logger.warn(`Notifications connection rejected: ${client.id} - ${error.message}`);
      client.disconnect();
    }
  }

  emitToUser(userId: number, notification: any): void {
    this.server.to(`user_${userId}`).emit('notification:created', notification);
  }
}
