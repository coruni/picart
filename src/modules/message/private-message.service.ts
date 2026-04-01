import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, IsNull, Repository } from "typeorm";
import { User } from "../user/entities/user.entity";
import { UserBlock } from "../user/entities/user-block.entity";
import { sanitizeUser, processUserDecorations } from "src/common/utils";
import { PrivateConversation } from "./entities/private-conversation.entity";
import { PrivateMessage, PrivateMessageKind } from "./entities/private-message.entity";
import {
  BatchReadPrivateMessagesDto,
  CursorPaginationDto,
  SendPrivateMessageDto,
} from "./dto/private-message.dto";

@Injectable()
export class PrivateMessageService {
  constructor(
    @InjectRepository(PrivateConversation)
    private readonly conversationRepository: Repository<PrivateConversation>,
    @InjectRepository(PrivateMessage)
    private readonly privateMessageRepository: Repository<PrivateMessage>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserBlock)
    private readonly userBlockRepository: Repository<UserBlock>,
  ) {}

  async sendPrivateMessage(
    sender: User,
    receiverId: number,
    dto: SendPrivateMessageDto,
  ) {
    if (!receiverId) {
      throw new BadRequestException("response.error.messageReceiverRequired");
    }
    if (sender.id === receiverId) {
      throw new BadRequestException("response.error.cannotSendMessageToSelf");
    }

    await this.ensureUsersCanChat(sender.id, receiverId);
    this.validatePrivateMessage(dto);

    const conversation = await this.findOrCreateConversation(sender.id, receiverId);
    const message = this.privateMessageRepository.create({
      conversationId: conversation.id,
      senderId: sender.id,
      receiverId,
      messageKind: dto.messageKind || "text",
      content: dto.content?.trim() || "",
      payload: dto.payload ?? null,
    });
    const savedMessage = await this.privateMessageRepository.save(message);

    await this.conversationRepository.update(conversation.id, {
      lastMessageId: savedMessage.id,
      lastMessageAt: savedMessage.createdAt,
    });

    return this.getPrivateMessageById(savedMessage.id, sender.id);
  }

  async getPrivateConversations(user: User, query: CursorPaginationDto) {
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    const qb = this.conversationRepository
      .createQueryBuilder("conversation")
      .leftJoinAndSelect("conversation.userOne", "userOne")
      .leftJoinAndSelect("conversation.userTwo", "userTwo")
      .leftJoinAndSelect("userOne.userDecorations", "userOneDecorations")
      .leftJoinAndSelect("userOneDecorations.decoration", "userOneDecoration")
      .leftJoinAndSelect("userTwo.userDecorations", "userTwoDecorations")
      .leftJoinAndSelect("userTwoDecorations.decoration", "userTwoDecoration")
      .leftJoinAndSelect("conversation.lastMessage", "lastMessage")
      .leftJoinAndSelect("lastMessage.sender", "lastMessageSender")
      .leftJoinAndSelect("lastMessage.receiver", "lastMessageReceiver")
      .where("(conversation.userOneId = :userId OR conversation.userTwoId = :userId)", {
        userId: user.id,
      })
      .orderBy("conversation.lastMessageAt", "DESC")
      .addOrderBy("conversation.id", "DESC")
      .take(limit + 1);

    const cursor = this.parseCursor(query.cursor);
    if (cursor) {
      qb.andWhere(
        "(conversation.lastMessageAt < :cursorTime OR (conversation.lastMessageAt = :cursorTime AND conversation.id < :cursorId))",
        {
          cursorTime: cursor.time,
          cursorId: cursor.id,
        },
      );
    }

    const rows = await qb.getMany();
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);

    const data = await Promise.all(
      items.map(async (conversation) => {
        const counterpart =
          conversation.userOneId === user.id
            ? conversation.userTwo
            : conversation.userOne;

        const unreadCount = await this.privateMessageRepository.count({
          where: {
            conversationId: conversation.id,
            receiverId: user.id,
            readAt: IsNull(),
          },
        });

        return {
          conversationId: conversation.id,
          counterpart: counterpart
            ? sanitizeUser(processUserDecorations(counterpart))
            : null,
          latestMessage: conversation.lastMessage
            ? this.serializePrivateMessage(conversation.lastMessage)
            : null,
          unreadCount,
          lastMessageAt: conversation.lastMessageAt,
        };
      }),
    );

    const lastItem = items[items.length - 1];
    return {
      data,
      meta: {
        limit,
        hasMore,
        nextCursor:
          hasMore && lastItem?.lastMessageAt
            ? this.encodeCursor(lastItem.lastMessageAt, lastItem.id)
            : null,
      },
    };
  }

  async getPrivateConversationMessages(
    user: User,
    counterpartId: number,
    query: CursorPaginationDto,
  ) {
    await this.ensureUsersCanChat(user.id, counterpartId, true);
    const conversation = await this.findConversation(user.id, counterpartId);
    if (!conversation) {
      return {
        data: [],
        meta: {
          limit: Math.min(Math.max(Number(query.limit) || 20, 1), 100),
          hasMore: false,
          nextCursor: null,
        },
      };
    }

    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    const qb = this.privateMessageRepository
      .createQueryBuilder("message")
      .leftJoinAndSelect("message.sender", "sender")
      .leftJoinAndSelect("message.receiver", "receiver")
      .leftJoinAndSelect("sender.userDecorations", "senderDecorations")
      .leftJoinAndSelect("senderDecorations.decoration", "senderDecoration")
      .leftJoinAndSelect("receiver.userDecorations", "receiverDecorations")
      .leftJoinAndSelect("receiverDecorations.decoration", "receiverDecoration")
      .where("message.conversationId = :conversationId", {
        conversationId: conversation.id,
      })
      .orderBy("message.createdAt", "DESC")
      .addOrderBy("message.id", "DESC")
      .take(limit + 1);

    const cursor = this.parseCursor(query.cursor);
    if (cursor) {
      qb.andWhere(
        "(message.createdAt < :cursorTime OR (message.createdAt = :cursorTime AND message.id < :cursorId))",
        {
          cursorTime: cursor.time,
          cursorId: cursor.id,
        },
      );
    }

    const rows = await qb.getMany();
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);
    const lastItem = items[items.length - 1];

    return {
      data: items.map((message) => this.serializePrivateMessage(message)),
      meta: {
        limit,
        hasMore,
        nextCursor:
          hasMore && lastItem
            ? this.encodeCursor(lastItem.createdAt, lastItem.id)
            : null,
      },
    };
  }

  async markMessagesAsRead(user: User, dto: BatchReadPrivateMessagesDto) {
    if (!dto.messageIds.length) {
      return { messageIds: [] };
    }

    const messages = await this.privateMessageRepository.find({
      where: dto.messageIds.map((id) => ({ id, receiverId: user.id })),
      relations: ["conversation"],
    });

    const unreadMessages = messages.filter((message) => !message.readAt);
    if (!unreadMessages.length) {
      return { messageIds: [] };
    }

    const readAt = new Date();
    await this.privateMessageRepository.update(
      { id: In(unreadMessages.map((message) => message.id)) },
      { readAt },
    );

    return {
      messageIds: unreadMessages.map((message) => message.id),
      readAt,
      receipts: unreadMessages.map((message) => ({
        messageId: message.id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        receiverId: message.receiverId,
        readAt,
      })),
    };
  }

  async recallMessage(user: User, messageId: number, reason?: string) {
    const message = await this.privateMessageRepository.findOne({
      where: { id: messageId },
      relations: ["sender", "receiver"],
    });

    if (!message) {
      throw new NotFoundException("response.error.messageNotFound");
    }
    if (message.senderId !== user.id) {
      throw new ForbiddenException("response.error.noPermissionRecallMessage");
    }
    if (message.recalledAt) {
      return this.getPrivateMessageById(message.id, user.id);
    }

    await this.privateMessageRepository.update(message.id, {
      recalledAt: new Date(),
      recalledById: user.id,
      recallReason: reason || null,
      content: "",
      payload: {
        ...(message.payload || {}),
        recalled: true,
      },
    });

    return this.getPrivateMessageById(message.id, user.id);
  }

  async blockUser(user: User, targetUserId: number) {
    if (user.id === targetUserId) {
      throw new BadRequestException("response.error.cannotBlockSelf");
    }
    const target = await this.userRepository.findOne({ where: { id: targetUserId } });
    if (!target) {
      throw new NotFoundException("response.error.userNotExist");
    }

    const existing = await this.userBlockRepository.findOne({
      where: { userId: user.id, blockedUserId: targetUserId },
    });
    if (!existing) {
      await this.userBlockRepository.save(
        this.userBlockRepository.create({
          userId: user.id,
          blockedUserId: targetUserId,
        }),
      );
    }
    return { success: true, blockedUserId: targetUserId };
  }

  async unblockUser(user: User, targetUserId: number) {
    await this.userBlockRepository.delete({
      userId: user.id,
      blockedUserId: targetUserId,
    });
    return { success: true, blockedUserId: targetUserId };
  }

  async getBlockedUsers(user: User) {
    const blocks = await this.userBlockRepository.find({
      where: { userId: user.id },
      relations: [
        "blockedUser",
        "blockedUser.userDecorations",
        "blockedUser.userDecorations.decoration",
      ],
      order: { createdAt: "DESC" },
    });
    return {
      data: blocks.map((block) => ({
        id: block.id,
        reason: block.reason,
        createdAt: block.createdAt,
        blockedUser: sanitizeUser(processUserDecorations(block.blockedUser)),
      })),
    };
  }

  async getPrivateMessageById(messageId: number, userId: number) {
    const message = await this.privateMessageRepository.findOne({
      where: [{ id: messageId, senderId: userId }, { id: messageId, receiverId: userId }],
      relations: [
        "sender",
        "receiver",
        "sender.userDecorations",
        "sender.userDecorations.decoration",
        "receiver.userDecorations",
        "receiver.userDecorations.decoration",
      ],
    });

    if (!message) {
      throw new NotFoundException("response.error.messageNotFound");
    }
    return this.serializePrivateMessage(message);
  }

  async getConversationSummaryForUser(userId: number, conversationId: number) {
    const conversation = await this.conversationRepository.findOne({
      where: [
        { id: conversationId, userOneId: userId },
        { id: conversationId, userTwoId: userId },
      ],
      relations: [
        "userOne",
        "userTwo",
        "userOne.userDecorations",
        "userOne.userDecorations.decoration",
        "userTwo.userDecorations",
        "userTwo.userDecorations.decoration",
        "lastMessage",
        "lastMessage.sender",
        "lastMessage.receiver",
      ],
    });
    if (!conversation) {
      return null;
    }

    const counterpart =
      conversation.userOneId === userId ? conversation.userTwo : conversation.userOne;
    const unreadCount = await this.privateMessageRepository.count({
      where: {
        conversationId,
        receiverId: userId,
        readAt: IsNull(),
      },
    });

    return {
      conversationId: conversation.id,
      counterpart: counterpart
        ? sanitizeUser(processUserDecorations(counterpart))
        : null,
      latestMessage: conversation.lastMessage
        ? this.serializePrivateMessage(conversation.lastMessage)
        : null,
      unreadCount,
      lastMessageAt: conversation.lastMessageAt,
    };
  }

  private async findOrCreateConversation(userAId: number, userBId: number) {
    const [userOneId, userTwoId] = [userAId, userBId].sort((a, b) => a - b);
    const existing = await this.conversationRepository.findOne({
      where: { userOneId, userTwoId },
    });
    if (existing) {
      return existing;
    }
    const created = this.conversationRepository.create({
      userOneId,
      userTwoId,
      lastMessageId: null,
      lastMessageAt: null,
    });
    return this.conversationRepository.save(created);
  }

  private async findConversation(userAId: number, userBId: number) {
    const [userOneId, userTwoId] = [userAId, userBId].sort((a, b) => a - b);
    return this.conversationRepository.findOne({
      where: { userOneId, userTwoId },
    });
  }

  private async ensureUsersCanChat(
    senderId: number,
    receiverId: number,
    ignoreMissingReceiver = false,
  ) {
    const sender = await this.userRepository.findOne({ where: { id: senderId } });
    const receiver = await this.userRepository.findOne({ where: { id: receiverId } });

    if (!sender || (!receiver && !ignoreMissingReceiver)) {
      throw new NotFoundException("response.error.userNotExist");
    }

    if (!receiver && ignoreMissingReceiver) {
      return;
    }

    const [blockedBySender, blockedByReceiver] = await Promise.all([
      this.userBlockRepository.exists({
        where: { userId: senderId, blockedUserId: receiverId },
      }),
      this.userBlockRepository.exists({
        where: { userId: receiverId, blockedUserId: senderId },
      }),
    ]);

    if (blockedBySender || blockedByReceiver) {
      throw new ForbiddenException("response.error.privateMessageBlocked");
    }
  }

  private validatePrivateMessage(dto: SendPrivateMessageDto) {
    const kind = dto.messageKind || "text";
    const content = dto.content?.trim() || "";

    if (kind === "text" && !content) {
      throw new BadRequestException("response.error.messageContentRequired");
    }

    if (kind !== "text" && !dto.payload) {
      throw new BadRequestException("response.error.messagePayloadRequired");
    }

    if (kind === "image" && !this.hasPayloadFields(dto.payload, ["url"])) {
      throw new BadRequestException("response.error.imageMessagePayloadInvalid");
    }

    if (kind === "file" && !this.hasPayloadFields(dto.payload, ["url", "name"])) {
      throw new BadRequestException("response.error.fileMessagePayloadInvalid");
    }

    if (
      kind === "card" &&
      !this.hasPayloadFields(dto.payload, ["title", "description"])
    ) {
      throw new BadRequestException("response.error.cardMessagePayloadInvalid");
    }
  }

  private hasPayloadFields(payload: Record<string, unknown> | undefined, fields: string[]) {
    if (!payload) return false;
    return fields.every((field) => Boolean(payload[field]));
  }

  private serializePrivateMessage(message: PrivateMessage) {
    return {
      ...message,
      type: "private",
      isRead: Boolean(message.readAt),
      isRecalled: Boolean(message.recalledAt),
      sender: message.sender
        ? sanitizeUser(processUserDecorations(message.sender))
        : null,
      receiver: message.receiver
        ? sanitizeUser(processUserDecorations(message.receiver))
        : null,
    };
  }

  private encodeCursor(time: Date, id: number) {
    return Buffer.from(
      JSON.stringify({ time: time.toISOString(), id }),
      "utf8",
    ).toString("base64");
  }

  private parseCursor(cursor?: string): { time: string; id: number } | null {
    if (!cursor) {
      return null;
    }
    try {
      const decoded = JSON.parse(Buffer.from(cursor, "base64").toString("utf8"));
      if (!decoded?.time || !decoded?.id) {
        return null;
      }
      return { time: decoded.time, id: Number(decoded.id) };
    } catch {
      return null;
    }
  }
}
