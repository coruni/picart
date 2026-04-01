import { Injectable } from "@nestjs/common";
import { Server } from "socket.io";
import { PrivateMessageService } from "./private-message.service";

@Injectable()
export class MessageRealtimeService {
  private server: Server | null = null;

  constructor(
    private readonly privateMessageService: PrivateMessageService,
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

    const summary = await this.privateMessageService.getConversationSummaryForUser(
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
}
