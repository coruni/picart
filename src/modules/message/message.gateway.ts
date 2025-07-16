import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MessageService } from './message.service';
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('jwt'))
@WebSocketGateway({ namespace: '/ws-message', cors: true })
export class MessageGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly messageService: MessageService) {}

  handleConnection(client: Socket) {
  }

  handleDisconnect(client: Socket) {
    // 断开连接处理
  }

  /**
   * 推送新消息给指定用户
   */
  async notifyUser(userId: number, message: any) {
    this.server.to(String(userId)).emit('newMessage', message);
  }

  /**
   * 用户加入房间（建议前端连接后立即 join）
   */
  async joinUserRoom(client: Socket, userId: number) {
    client.join(String(userId));
  }
}
