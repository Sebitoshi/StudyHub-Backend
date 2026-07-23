import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { GroupChatService } from './group-chat.service';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  namespace: '/group-chat',
  cors: { origin: '*' },
})
export class GroupChatGateway implements OnGatewayConnection {
  private readonly logger = new Logger(GroupChatGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private chatService: GroupChatService,
    private jwtService: JwtService,
  ) {}

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
      this.logger.log(`Client connected: ${client.id} (user: ${payload.sub})`);
    } catch (error) {
      this.logger.warn(`Connection rejected: ${client.id} - ${error.message}`);
      client.disconnect();
    }
  }

  @SubscribeMessage('join-room')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { groupId: number },
  ) {
    const room = `group_${data.groupId}`;
    client.join(room);
  }

  @SubscribeMessage('leave-room')
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { groupId: number },
  ) {
    const room = `group_${data.groupId}`;
    client.leave(room);
  }

  @SubscribeMessage('send-message')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { groupId: number; content: string },
  ) {
    const userId = client.data.user.sub;
    const message = await this.chatService.saveMessage(
      data.groupId,
      userId,
      data.content,
    );
    this.server.to(`group_${data.groupId}`).emit('message-received', message);
  }

  // Method to emit image message from HTTP controller
  emitImageMessage(groupId: number, message: any) {
    this.server.to(`group_${groupId}`).emit('message-received', message);
  }
}
