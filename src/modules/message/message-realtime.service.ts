import { forwardRef, Inject, Injectable } from "@nestjs/common";
import { Server } from "socket.io";
import { PrivateMessageService } from "./private-message.service";
import { MessageService } from "./message.service";
import { User } from "../user/entities/user.entity";

@Injectable()
export class MessageRealtimeService {
  private server: Server | null = null;

  constructor(
    private readonly privateMessageService: PrivateMessageService,
    @Inject(forwardRef(() => MessageService))
    private readonly messageService: MessageService,
  ) {}

  registerServer(server: Server) {
    this.server = server;
  }

  notifyUser(userId: number, message: unknown) {
    this.server?.to(String(userId)).emit("newMessage", message);
  }

  async emitConversationUpdated(userId: number, conversationId: number) {
    if (!this.server) {
      return;
    }

    const summary =
      await this.privateMessageService.getConversationSummaryForUser(
        userId,
        conversationId,
      );
    if (summary) {
      this.server
        .to(String(userId))
        .emit("privateConversationUpdated", summary);
    }
  }

  async emitPrivateMessage(senderId: number, receiverId: number, message: any) {
    if (!this.server) {
      return;
    }

    this.notifyUser(receiverId, message);
    this.server.to(String(receiverId)).emit("privateMessage", message);
    this.server.to(String(senderId)).emit("newMessage", message);
    this.server.to(String(senderId)).emit("privateMessage", message);

    await Promise.all([
      this.emitConversationUpdated(senderId, message.conversationId),
      this.emitConversationUpdated(receiverId, message.conversationId),
    ]);
  }

  async emitPrivateConversationRead(
    reader: User,
    counterpartId: number,
    conversationId: number,
    messageIds: number[],
    readAt: Date,
  ) {
    if (!this.server) {
      return;
    }

    const receipt = {
      conversationId,
      senderId: counterpartId,
      receiverId: reader.id,
      messageIds,
      readAt,
    };

    this.server
      .to(String(counterpartId))
      .emit("privateMessagesReadReceipt", receipt);
    this.server
      .to(String(reader.id))
      .emit("privateConversationRead", receipt);

    await Promise.all([
      this.emitConversationUpdated(reader.id, conversationId),
      this.emitConversationUpdated(counterpartId, conversationId),
      this.emitUnreadCount(reader),
    ]);
  }

  async emitUnreadCount(user: User) {
    if (!this.server) {
      return;
    }
    const unreadCount = await this.messageService.getUnreadCount(user);
    this.server.to(String(user.id)).emit("unreadCount", unreadCount);
  }
}
