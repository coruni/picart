import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MessageService } from './message.service';
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { User } from '../user/entities/user.entity';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../user/user.service';

@UseGuards(AuthGuard('jwt'))
@WebSocketGateway({ 
  namespace: '/ws-message', 
  cors: true,
  transports: ['websocket', 'polling'] // 确保传输方式正确
})
export class MessageGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly messageService: MessageService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly userService: UserService,
  ) {}

  async handleConnection(client: Socket) {
    console.log('客户端尝试连接:', client.id);
    
    // 获取并处理 token
    let token =
      client.handshake?.auth?.token ||
      client.handshake?.headers?.authorization ||
      client.handshake?.query?.token;

    // 处理数组类型的 token
    if (Array.isArray(token)) token = token[0];

    if (!token) {
      console.log('未提供 token');
      client.emit('error', { message: '未提供 token，连接已断开' });
      client.disconnect();
      return;
    }

    // 移除 Bearer 前缀
    if (typeof token === 'string' && token.startsWith('Bearer ')) {
      token = token.slice(7);
    }

    try {
      // 验证 token
      const secret = this.configService.get<string>('JWT_SECRET', 'your-secret-key');
      const payload = this.jwtService.verify(token, { secret });

      // 获取用户信息
      const user = await this.userService.findOne(payload.sub);
      if (!user) throw new Error('用户不存在');

      // 挂载用户信息到 socket
      client.data.user = user;

      // 自动加入用户专属房间
      await client.join(String(user.id));
      
      console.log(`用户 ${user.username} 连接成功，已加入房间: ${user.id}`);

      // 发送连接成功消息
      client.emit('connected', {
        message: '连接成功',
        user: {
          id: user.id,
          username: user.username,
          nickname: user.nickname,
          avatar: user.avatar,
        },
      });
    } catch (e) {
      console.log('认证失败:', e.message);
      client.emit('error', {
        message: '认证失败: ' + (e.message || 'token无效或已过期'),
        code: 'AUTH_FAILED',
      });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const user = client.data?.user;
    if (user) {
      console.log(`用户 ${user.username} 断开连接`);
    }
  }

  /**
   * 推送新消息给指定用户
   */
  async notifyUser(userId: number, message: any) {
    this.server.to(String(userId)).emit('newMessage', message);
  }

  /**
   * 用户手动加入房间（可选，因为连接时已自动加入）
   */
  @SubscribeMessage('join')
  async handleJoin(@ConnectedSocket() client: Socket) {
    const user: User = client.data.user;
    if (!user) {
      client.emit('error', { message: '用户信息获取失败', code: 'USER_NOT_FOUND' });
      return;
    }
    
    // 确保用户在自己的房间中
    await client.join(String(user.id));
    
    console.log(`用户 ${user.username} 手动加入房间: ${user.id}`);
    
    // 返回加入成功的消息
    client.emit('joined', { 
      userId: user.id,
      message: '成功加入房间',
      room: String(user.id)
    });
    
    return { success: true, userId: user.id };
  }

  /**
   * 用户离开自己的专属房间
   */
  @SubscribeMessage('leave')
  async handleLeave(@ConnectedSocket() client: Socket) {
    const user: User = client.data.user;
    if (!user) {
      client.emit('error', { message: '用户信息获取失败', code: 'USER_NOT_FOUND' });
      return;
    }
    
    await client.leave(String(user.id));
    
    console.log(`用户 ${user.username} 离开房间: ${user.id}`);
    
    client.emit('leaved', { 
      userId: user.id,
      message: '成功离开房间',
      room: String(user.id)
    });
    
    return { success: true, userId: user.id };
  }

  /**
   * 发送消息
   */
  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @MessageBody()
    data: {
      content: string;
      toUserId?: number;
      receiverIds?: number[];
      isBroadcast?: boolean;
      type?: 'private' | 'system' | 'notification';
    },
    @ConnectedSocket() client: Socket,
  ) {
    const user: User = client.data.user;
    if (!user) {
      client.emit('error', { message: '用户信息获取失败', code: 'USER_NOT_FOUND' });
      return;
    }

    try {
      // 创建消息
      const savedMessage = await this.messageService.create(
        {
          senderId: user.id,
          content: data.content,
          receiverId: data.toUserId,
          receiverIds: data.receiverIds,
          isBroadcast: data.isBroadcast,
          type: data.type || 'private',
        },
        user,
      );

      // 消息分发逻辑
      if (data.isBroadcast) {
        // 广播消息
        this.server.emit('newMessage', savedMessage);
      } else if (data.toUserId) {
        // 单发消息
        this.notifyUser(data.toUserId, savedMessage);
        client.emit('newMessage', savedMessage); // 发送方也收到
      } else if (data.receiverIds?.length) {
        // 群发消息
        data.receiverIds.forEach((id) => this.notifyUser(id, savedMessage));
        client.emit('newMessage', savedMessage); // 发送方也收到
      } else {
        // 默认发送给自己（调试用）
        client.emit('newMessage', savedMessage);
      }

      return { success: true, message: savedMessage };
    } catch (error) {
      client.emit('error', {
        message: '消息发送失败: ' + error.message,
        code: 'MESSAGE_SEND_FAILED',
      });
    }
  }

  /**
   * 获取历史消息
   */
  @SubscribeMessage('getHistory')
  async handleGetHistory(
    @MessageBody() data: { page?: number; limit?: number },
    @ConnectedSocket() client: Socket,
  ) {
    const user: User = client.data.user;
    if (!user) {
      client.emit('error', { message: '用户信息获取失败', code: 'USER_NOT_FOUND' });
      return;
    }

    try {
      const history = await this.messageService.findAllByUser(user, {
        page: data.page || 1,
        limit: data.limit || 20,
      });
      client.emit('history', history);
      return { success: true, data: history };
    } catch (error) {
      client.emit('error', {
        message: '获取历史消息失败: ' + error.message,
        code: 'HISTORY_FETCH_FAILED',
      });
    }
  }

  /**
   * 标记消息为已读
   */
  @SubscribeMessage('readMessage')
  async handleReadMessage(
    @MessageBody() data: { messageId: number },
    @ConnectedSocket() client: Socket,
  ) {
    const user: User = client.data.user;
    if (!user) {
      client.emit('error', { message: '用户信息获取失败', code: 'USER_NOT_FOUND' });
      return;
    }

    try {
      await this.messageService.markAsRead(data.messageId, user);
      client.emit('read', { messageId: data.messageId });
      return { success: true, messageId: data.messageId };
    } catch (error) {
      client.emit('error', {
        message: '标记已读失败: ' + error.message,
        code: 'MARK_READ_FAILED',
      });
    }
  }

  /**
   * 获取当前用户信息
   */
  @SubscribeMessage('getProfile')
  async handleGetProfile(@ConnectedSocket() client: Socket) {
    const user: User = client.data.user;
    if (!user) {
      client.emit('error', { message: '用户信息获取失败', code: 'USER_NOT_FOUND' });
      return;
    }

    const profile = {
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      avatar: user.avatar,
    };

    client.emit('profile', profile);
    return { success: true, data: profile };
  }

  /**
   * 测试连接状态
   */
  @SubscribeMessage('ping')
  async handlePing(@ConnectedSocket() client: Socket) {
    const user: User = client.data.user;
    client.emit('pong', { 
      message: 'pong',
      userId: user?.id,
      timestamp: new Date().toISOString()
    });
    return { success: true };
  }
}