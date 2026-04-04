import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { MessageService } from "./message.service";
import { User } from "../user/entities/user.entity";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { UserService } from "../user/user.service";
import { getHeaderValue, PermissionUtil } from "src/common/utils";
import { PrivateMessageService } from "./private-message.service";
import { MessageRealtimeService } from "./message-realtime.service";
import { MessagePresenceService } from "./message-presence.service";

@WebSocketGateway({
  namespace: "/ws-message",
  cors: true,
  transports: ["websocket", "polling"], // 确保传输方式正确
})
export class MessageGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly messageService: MessageService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly userService: UserService,
    private readonly privateMessageService: PrivateMessageService,
    private readonly messageRealtimeService: MessageRealtimeService,
    private readonly messagePresenceService: MessagePresenceService,
  ) {}

  afterInit(server: Server) {
    this.messageRealtimeService.registerServer(server);
  }

  async handleConnection(client: Socket) {
    console.log("客户端尝试连接:", client.id);

    // 获取并处理 token
    let token =
      client.handshake?.auth?.token ||
      client.handshake?.headers?.authorization ||
      client.handshake?.query?.token;

    // 处理数组类型的 token
    if (Array.isArray(token)) token = token[0];

    if (!token) {
      console.log("未提供 token");
      client.emit("error", { message: "未提供 token，连接已断开" });
      client.disconnect();
      return;
    }

    // 移除 Bearer 前缀
    if (typeof token === "string" && token.startsWith("Bearer ")) {
      token = token.slice(7);
    }

    const deviceId = getHeaderValue(
      client.handshake?.headers as Record<string, unknown> | undefined,
      "device-id",
    );

    try {
      // 验证 token
      const secret = this.configService.get<string>(
        "JWT_SECRET",
        "your-secret-key",
      );
      const payload = this.jwtService.verify(token, { secret });

      // 获取用户信息
      const user = await this.userService.findOneById(payload.sub);
      if (!user) throw new Error("用户不存在");

      // 挂载用户信息到 socket
      client.data.user = user;

      // 自动加入用户专属房间
      const presence = await this.messagePresenceService.handleConnected(
        user.id,
        client.id,
        deviceId,
      );
      await client.join(String(user.id));
      if (presence.becameOnline) {
        this.server
          .to(this.messagePresenceService.getPresenceRoom(user.id))
          .emit("userStatusChanged", presence.payload);
      }

      console.log(`用户 ${user.username} 连接成功，已加入房间: ${user.id}`);

      // 发送连接成功消息
      client.emit("connected", {
        message: "连接成功",
        user: {
          id: user.id,
          username: user.username,
          nickname: user.nickname,
          avatar: user.avatar,
        },
      });
    } catch (e) {
      console.log("认证失败:", e.message);
      client.emit("error", {
        message: "认证失败: " + (e.message || "token无效或已过期"),
        code: "AUTH_FAILED",
      });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const user = client.data?.user;
    if (user) {
      console.log(`用户 ${user.username} 断开连接`);
    }
    void this.messagePresenceService
      .handleDisconnected(client.id)
      .then((presence) => {
        if (presence?.becameOffline) {
          this.server
            .to(
              this.messagePresenceService.getPresenceRoom(
                presence.payload.userId,
              ),
            )
            .emit("userStatusChanged", presence.payload);
        }
      });
  }

  /**
   * 推送新消息给指定用户
   */
  notifyUser(userId: number, message: any) {
    this.messageRealtimeService.notifyUser(userId, message);
  }

  async emitConversationUpdated(userId: number, conversationId: number) {
    await this.messageRealtimeService.emitConversationUpdated(
      userId,
      conversationId,
    );
  }

  /**
   * 用户手动加入房间（可选，因为连接时已自动加入）
   */
  @SubscribeMessage("join")
  async handleJoin(@ConnectedSocket() client: Socket) {
    const user: User = client.data.user;
    if (!user) {
      client.emit("error", {
        message: "用户信息获取失败",
        code: "USER_NOT_FOUND",
      });
      return;
    }

    // 确保用户在自己的房间中
    await client.join(String(user.id));

    console.log(`用户 ${user.username} 手动加入房间: ${user.id}`);

    // 返回加入成功的消息
    client.emit("joined", {
      userId: user.id,
      message: "成功加入房间",
      room: String(user.id),
    });

    return { success: true, userId: user.id };
  }

  /**
   * 用户离开自己的专属房间
   */
  @SubscribeMessage("leave")
  async handleLeave(@ConnectedSocket() client: Socket) {
    const user: User = client.data.user;
    if (!user) {
      client.emit("error", {
        message: "用户信息获取失败",
        code: "USER_NOT_FOUND",
      });
      return;
    }

    await client.leave(String(user.id));

    console.log(`用户 ${user.username} 离开房间: ${user.id}`);

    client.emit("leaved", {
      userId: user.id,
      message: "成功离开房间",
      room: String(user.id),
    });

    return { success: true, userId: user.id };
  }

  /**
   * 发送消息
   */
  @SubscribeMessage("sendMessage")
  async handleSendMessage(
    @MessageBody()
    data: {
      content?: string;
      toUserId?: number;
      receiverIds?: number[];
      isBroadcast?: boolean;
      type?: "private" | "system" | "notification";
      messageKind?: "text" | "image" | "file" | "card";
      payload?: Record<string, unknown>;
    },
    @ConnectedSocket() client: Socket,
  ) {
    const user: User = client.data.user;
    if (!user) {
      client.emit("error", {
        message: "用户信息获取失败",
        code: "USER_NOT_FOUND",
      });
      return;
    }

    // 检查广播消息权限
    if (
      data.isBroadcast &&
      !PermissionUtil.hasPermission(user, "message:create")
    ) {
      client.emit("error", {
        message: "无权限发送广播消息",
        code: "NO_PERMISSION_BROADCAST",
      });
      return;
    }

    try {
      let messagePayload: any;

      if ((data.type || "private") === "private" && data.toUserId) {
        messagePayload = await this.privateMessageService.sendPrivateMessage(
          user,
          data.toUserId,
          {
            content: data.content,
            messageKind: data.messageKind || "text",
            payload: data.payload,
          },
        );
      } else {
        const created = await this.messageService.create(
          {
            senderId: user.id,
            content: data.content || "",
            receiverId: data.toUserId,
            receiverIds: data.receiverIds,
            isBroadcast: data.isBroadcast,
            type: data.type || "private",
          },
          user,
        );
        messagePayload = created.data;
      }

      // 消息分发逻辑
      if (data.isBroadcast) {
        // 广播消息
        this.server.emit("newMessage", messagePayload);
      } else if (data.toUserId) {
        // 单发消息
        await this.messageRealtimeService.emitPrivateMessage(
          user.id,
          data.toUserId,
          messagePayload,
        );
      } else if (data.receiverIds?.length) {
        // 群发消息
        data.receiverIds.forEach((id) => this.notifyUser(id, messagePayload));
        client.emit("newMessage", messagePayload);
      } else {
        // 默认发送给自己（调试用）
        client.emit("newMessage", messagePayload);
      }

      return { success: true, data: messagePayload };
    } catch (error) {
      client.emit("error", {
        message: "消息发送失败: " + error.message,
        code: "MESSAGE_SEND_FAILED",
      });
    }
  }

  /**
   * 获取历史消息
   */
  @SubscribeMessage("getHistory")
  async handleGetHistory(
    @MessageBody() data: { page?: number; limit?: number },
    @ConnectedSocket() client: Socket,
  ) {
    const user: User = client.data.user;
    if (!user) {
      client.emit("error", {
        message: "用户信息获取失败",
        code: "USER_NOT_FOUND",
      });
      return;
    }

    try {
      const history = await this.messageService.findAllByUser(user, {
        page: data.page || 1,
        limit: data.limit || 20,
      });
      client.emit("history", history);
      return { success: true, data: history };
    } catch (error) {
      client.emit("error", {
        message: "获取历史消息失败: " + error.message,
        code: "HISTORY_FETCH_FAILED",
      });
    }
  }

  @SubscribeMessage("getPrivateConversations")
  async handleGetPrivateConversations(
    @MessageBody() data: { cursor?: string; limit?: number },
    @ConnectedSocket() client: Socket,
  ) {
    const user: User = client.data.user;
    if (!user) {
      client.emit("error", {
        message: "用户信息获取失败",
        code: "USER_NOT_FOUND",
      });
      return;
    }

    try {
      const conversations =
        await this.privateMessageService.getPrivateConversations(user, {
          cursor: data.cursor,
          limit: data.limit || 20,
        });
      client.emit("privateConversations", conversations);
      return { success: true, data: conversations };
    } catch (error) {
      client.emit("error", {
        message: "获取私信会话失败: " + error.message,
        code: "PRIVATE_CONVERSATIONS_FETCH_FAILED",
      });
    }
  }

  @SubscribeMessage("getPrivateHistory")
  async handleGetPrivateHistory(
    @MessageBody() data: { userId: number; cursor?: string; limit?: number },
    @ConnectedSocket() client: Socket,
  ) {
    const user: User = client.data.user;
    if (!user) {
      client.emit("error", {
        message: "用户信息获取失败",
        code: "USER_NOT_FOUND",
      });
      return;
    }

    try {
      const history =
        await this.privateMessageService.getPrivateConversationMessages(
          user,
          data.userId,
          {
            cursor: data.cursor,
            limit: data.limit || 20,
          },
        );
      client.emit("privateHistory", history);
      return { success: true, data: history };
    } catch (error) {
      client.emit("error", {
        message: "获取私信历史失败: " + error.message,
        code: "PRIVATE_HISTORY_FETCH_FAILED",
      });
    }
  }

  @SubscribeMessage("readPrivateMessages")
  async handleReadPrivateMessages(
    @MessageBody() data: { messageIds: number[] },
    @ConnectedSocket() client: Socket,
  ) {
    const user: User = client.data.user;
    if (!user) {
      client.emit("error", {
        message: "用户信息获取失败",
        code: "USER_NOT_FOUND",
      });
      return;
    }

    try {
      const result = await this.privateMessageService.markMessagesAsRead(user, {
        messageIds: data.messageIds || [],
      });
      client.emit("privateMessagesRead", result);
      for (const receipt of result.receipts || []) {
        this.server
          .to(String(receipt.senderId))
          .emit("privateMessagesReadReceipt", receipt);
        await this.emitConversationUpdated(
          receipt.senderId,
          receipt.conversationId,
        );
        await this.emitConversationUpdated(
          receipt.receiverId,
          receipt.conversationId,
        );
      }
      return { success: true, data: result };
    } catch (error) {
      client.emit("error", {
        message: "批量标记私信已读失败: " + error.message,
        code: "PRIVATE_MESSAGES_READ_FAILED",
      });
    }
  }

  @SubscribeMessage("recallPrivateMessage")
  async handleRecallPrivateMessage(
    @MessageBody() data: { messageId: number; reason?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const user: User = client.data.user;
    if (!user) {
      client.emit("error", {
        message: "用户信息获取失败",
        code: "USER_NOT_FOUND",
      });
      return;
    }

    try {
      const message = await this.privateMessageService.recallMessage(
        user,
        data.messageId,
        data.reason,
      );
      this.server
        .to(String(message.senderId))
        .emit("privateMessageRecalled", message);
      this.server
        .to(String(message.receiverId))
        .emit("privateMessageRecalled", message);
      await Promise.all([
        this.emitConversationUpdated(message.senderId, message.conversationId),
        this.emitConversationUpdated(
          message.receiverId,
          message.conversationId,
        ),
      ]);
      return { success: true, data: message };
    } catch (error) {
      client.emit("error", {
        message: "撤回私信失败: " + error.message,
        code: "PRIVATE_MESSAGE_RECALL_FAILED",
      });
    }
  }

  /**
   * 获取未读消息数量
   */
  @SubscribeMessage("getUnreadCount")
  async handleGetUnreadCount(
    @MessageBody() _data: Record<string, never> | undefined,
    @ConnectedSocket() client: Socket,
  ) {
    const user: User = client.data.user;
    if (!user) {
      client.emit("error", {
        message: "Failed to get user information",
        code: "USER_NOT_FOUND",
      });
      return;
    }

    try {
      const unreadCount = await this.messageService.getUnreadCount(user);
      client.emit("unreadCount", unreadCount);
      return { success: true, data: unreadCount };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "unknown error";
      client.emit("error", {
        message: "Failed to fetch unread counts: " + errorMessage,
        code: "UNREAD_COUNT_FETCH_FAILED",
      });
    }
  }

  /**
   * 标记所有消息为已读
   */
  @SubscribeMessage("markAllAsRead")
  async handleMarkAllAsRead(
    @MessageBody()
    data: {
      type?: "private" | "system" | "notification";
      isBroadcast?: boolean;
    },
    @ConnectedSocket() client: Socket,
  ) {
    const user: User = client.data.user;
    if (!user) {
      client.emit("error", {
        message: "用户信息获取失败",
        code: "USER_NOT_FOUND",
      });
      return;
    }

    try {
      const result = await this.messageService.markAllAsRead(data, user);
      const unreadCount = await this.messageService.getUnreadCount(user);
      client.emit("allMarkedAsRead", result);
      client.emit("unreadCount", unreadCount);
      return { success: true, data: result };
    } catch (error) {
      client.emit("error", {
        message: "标记所有消息为已读失败: " + error.message,
        code: "MARK_ALL_READ_FAILED",
      });
    }
  }

  /**
   * 批量操作消息
   */
  @SubscribeMessage("batchOperation")
  async handleBatchOperation(
    @MessageBody() data: { messageIds: number[]; action: "read" | "delete" },
    @ConnectedSocket() client: Socket,
  ) {
    const user: User = client.data.user;
    if (!user) {
      client.emit("error", {
        message: "用户信息获取失败",
        code: "USER_NOT_FOUND",
      });
      return;
    }

    try {
      const result = await this.messageService.batchOperation(data, user);
      client.emit("batchOperationResult", result);
      return { success: true, data: result };
    } catch (error) {
      client.emit("error", {
        message: "批量操作失败: " + error.message,
        code: "BATCH_OPERATION_FAILED",
      });
    }
  }

  /**
   * 标记消息为已读
   */
  @SubscribeMessage("readMessage")
  async handleReadMessage(
    @MessageBody() data: { messageId: number },
    @ConnectedSocket() client: Socket,
  ) {
    const user: User = client.data.user;
    if (!user) {
      client.emit("error", {
        message: "用户信息获取失败",
        code: "USER_NOT_FOUND",
      });
      return;
    }

    try {
      await this.messageService.markAsRead(data.messageId, user);
      client.emit("read", { messageId: data.messageId });
      return { success: true, messageId: data.messageId };
    } catch (error) {
      client.emit("error", {
        message: "标记已读失败: " + error.message,
        code: "MARK_READ_FAILED",
      });
    }
  }

  /**
   * 获取当前用户信息
   */
  @SubscribeMessage("getProfile")
  async handleGetProfile(@ConnectedSocket() client: Socket) {
    const user: User = client.data.user;
    if (!user) {
      client.emit("error", {
        message: "用户信息获取失败",
        code: "USER_NOT_FOUND",
      });
      return;
    }

    const profile = {
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      avatar: user.avatar,
    };

    client.emit("profile", profile);
    return { success: true, data: profile };
  }

  /**
   * 测试连接状态
   */
  @SubscribeMessage("subscribeUserStatus")
  async handleSubscribeUserStatus(
    @MessageBody() data: { userId: number },
    @ConnectedSocket() client: Socket,
  ) {
    const user: User = client.data.user;
    if (!user) {
      client.emit("error", {
        message: "鐢ㄦ埛淇℃伅鑾峰彇澶辫触",
        code: "USER_NOT_FOUND",
      });
      return;
    }

    if (!data?.userId) {
      client.emit("error", {
        message: "userId is required",
        code: "USER_STATUS_USER_ID_REQUIRED",
      });
      return;
    }

    await client.join(this.messagePresenceService.getPresenceRoom(data.userId));
    const presence = await this.messagePresenceService.getUserPresence(
      data.userId,
    );
    client.emit("userStatus", presence);
    return { success: true, data: presence };
  }

  @SubscribeMessage("unsubscribeUserStatus")
  async handleUnsubscribeUserStatus(
    @MessageBody() data: { userId: number },
    @ConnectedSocket() client: Socket,
  ) {
    const user: User = client.data.user;
    if (!user) {
      client.emit("error", {
        message: "鐢ㄦ埛淇℃伅鑾峰彇澶辫触",
        code: "USER_NOT_FOUND",
      });
      return;
    }

    if (!data?.userId) {
      client.emit("error", {
        message: "userId is required",
        code: "USER_STATUS_USER_ID_REQUIRED",
      });
      return;
    }

    await client.leave(
      this.messagePresenceService.getPresenceRoom(data.userId),
    );
    return { success: true, userId: data.userId };
  }

  @SubscribeMessage("getUserStatus")
  async handleGetUserStatus(
    @MessageBody() data: { userId: number },
    @ConnectedSocket() client: Socket,
  ) {
    const user: User = client.data.user;
    if (!user) {
      client.emit("error", {
        message: "鐢ㄦ埛淇℃伅鑾峰彇澶辫触",
        code: "USER_NOT_FOUND",
      });
      return;
    }

    if (!data?.userId) {
      client.emit("error", {
        message: "userId is required",
        code: "USER_STATUS_USER_ID_REQUIRED",
      });
      return;
    }

    const presence = await this.messagePresenceService.getUserPresence(
      data.userId,
    );
    client.emit("userStatus", presence);
    return { success: true, data: presence };
  }

  @SubscribeMessage("ping")
  async handlePing(@ConnectedSocket() client: Socket) {
    const user: User = client.data.user;
    if (user) {
      const deviceId = getHeaderValue(client.handshake?.headers, "device-id");
      await this.messagePresenceService.touchOnlineUser(user.id, deviceId);
    }
    client.emit("pong", {
      message: "pong",
      userId: user?.id,
      timestamp: new Date().toISOString(),
    });
    return { success: true };
  }
}
