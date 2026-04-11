import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In, IsNull, Brackets } from "typeorm";
import { Message } from "./entities/message.entity";
import { MessageRead } from "./entities/message-read.entity";
import { CreateMessageDto } from "./dto/create-message.dto";
import { UpdateMessageDto } from "./dto/update-message.dto";
import { QueryMessageDto } from "./dto/query-message.dto";
import { BatchMessageDto, MarkAllReadDto } from "./dto/batch-message.dto";
import { ListUtil } from "src/common/utils/list.util";
import { PermissionUtil } from "src/common/utils/permission.util";
import { User } from "../user/entities/user.entity";
import { PaginationDto } from "src/common/dto/pagination.dto";
import { sanitizeUser, processUserDecorations } from "src/common/utils";
import { UserBlock } from "../user/entities/user-block.entity";
import { PrivateMessage } from "./entities/private-message.entity";

@Injectable()
export class MessageService {
  private static readonly MESSAGE_RELATIONS = [
    "sender",
    "sender.userDecorations",
    "sender.userDecorations.decoration",
    "receiver",
    "receiver.userDecorations",
    "receiver.userDecorations.decoration",
  ] as const;

  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(MessageRead)
    private readonly messageReadRepository: Repository<MessageRead>,
    @InjectRepository(PrivateMessage)
    private readonly privateMessageRepository: Repository<PrivateMessage>,
    @InjectRepository(UserBlock)
    private readonly userBlockRepository: Repository<UserBlock>,
  ) {}

  async create(createMessageDto: CreateMessageDto, user: User) {
    if (
      createMessageDto.isBroadcast &&
      !PermissionUtil.hasPermission(user, "message:create")
    ) {
      throw new ForbiddenException("response.error.noPermissionSendBroadcast");
    }

    if (createMessageDto.isBroadcast) {
      const message = this.messageRepository.create({
        ...createMessageDto,
        receiverId: null,
        isBroadcast: true,
      });
      const savedMessage = await this.messageRepository.save(message);
      return {
        success: true,
        message: "response.success.messageCreate",
        data: savedMessage,
      };
    }

    if (
      createMessageDto.receiverIds &&
      createMessageDto.receiverIds.length > 0
    ) {
      const messages = createMessageDto.receiverIds.map((receiverId) =>
        this.messageRepository.create({
          ...createMessageDto,
          receiverId,
          isBroadcast: false,
        }),
      );
      const savedMessages = await this.messageRepository.save(messages);
      return {
        success: true,
        message: "response.success.messageCreate",
        data: savedMessages,
      };
    }

    const message = this.messageRepository.create({
      ...createMessageDto,
      isBroadcast: false,
    });
    const savedMessage = await this.messageRepository.save(message);
    return {
      success: true,
      message: "response.success.messageCreate",
      data: savedMessage,
    };
  }

  private buildAccessibleMessageQuery(userId: number) {
    return this.messageRepository
      .createQueryBuilder("message")
      .leftJoin(
        "message_read",
        "messageRead",
        "messageRead.messageId = message.id AND messageRead.userId = :userId",
        { userId },
      )
      .where(
        new Brackets((qb) => {
          qb.where("message.receiverId = :userId", { userId }).orWhere(
            "message.isBroadcast = :isBroadcast",
            { isBroadcast: true },
          );
        }),
      );
  }

  private applyMessageFilters(
    queryBuilder: ReturnType<MessageService["buildAccessibleMessageQuery"]>,
    filters: {
      userId: number;
      type?: "private" | "system" | "notification";
      isRead?: boolean;
      isBroadcast?: boolean;
      keyword?: string;
      senderId?: number;
      receiverId?: number;
    },
  ) {
    const { userId, type, isRead, isBroadcast, keyword, senderId, receiverId } =
      filters;

    if (type) {
      queryBuilder.andWhere("message.type = :type", { type });
    }

    if (senderId) {
      queryBuilder.andWhere("message.senderId = :senderId", { senderId });
    }

    if (receiverId) {
      queryBuilder.andWhere("message.receiverId = :receiverId", { receiverId });
    }

    if (keyword) {
      queryBuilder.andWhere("message.content LIKE :keyword", {
        keyword: `%${keyword}%`,
      });
    }

    if (isBroadcast !== undefined) {
      queryBuilder.andWhere("message.isBroadcast = :isBroadcast", {
        isBroadcast,
      });
    }

    if (isRead !== undefined) {
      queryBuilder.andWhere(
        new Brackets((qb) => {
          qb.where(
            "message.isBroadcast = true AND messageRead.id IS " +
              (isRead ? "NOT NULL" : "NULL"),
          ).orWhere(
            "message.isBroadcast = false AND message.isRead = :isRead",
            {
              isRead,
            },
          );
        }),
      );
    }

    if (receiverId === undefined && isBroadcast !== false) {
      queryBuilder.setParameter("userId", userId);
    }

    return queryBuilder;
  }

  private async getPagedMessages(
    userId: number,
    page: number,
    limit: number,
    filters: {
      type?: "private" | "system" | "notification";
      isRead?: boolean;
      isBroadcast?: boolean;
      keyword?: string;
      senderId?: number;
      receiverId?: number;
    } = {},
  ) {
    const baseQuery = this.applyMessageFilters(
      this.buildAccessibleMessageQuery(userId),
      { userId, ...filters },
    );

    const total = await baseQuery
      .clone()
      .select("COUNT(DISTINCT message.id)", "total")
      .getRawOne();
    const totalCount = Number(total?.total || 0);

    if (totalCount === 0) {
      return { messages: [], total: 0 };
    }

    const idRows = await baseQuery
      .clone()
      .select("message.id", "id")
      .orderBy("message.createdAt", "DESC")
      .addOrderBy("message.id", "DESC")
      .skip((page - 1) * limit)
      .take(limit)
      .getRawMany();

    const messageIds = idRows.map((row) => Number(row.id));
    if (messageIds.length === 0) {
      return { messages: [], total: totalCount };
    }

    const messages = await this.messageRepository.find({
      where: { id: In(messageIds) },
      relations: [...MessageService.MESSAGE_RELATIONS],
    });

    const broadcastReadRows = await this.messageReadRepository.find({
      where: {
        userId,
        messageId: In(messageIds),
      },
      select: ["messageId"],
    });
    const broadcastReadSet = new Set(
      broadcastReadRows.map((record) => record.messageId),
    );

    // Get all sender and receiver IDs from messages
    const allUserIds = new Set<number>();
    messages.forEach((msg) => {
      if (msg.senderId) allUserIds.add(msg.senderId);
      if (msg.receiverId) allUserIds.add(msg.receiverId);
    });

    // Get blocked user IDs for the current user
    const blockedUserIds = allUserIds.size > 0
      ? await this.userBlockRepository
          .createQueryBuilder("block")
          .where("block.userId = :userId", { userId })
          .andWhere("block.blockedUserId IN (:...allUserIds)", { allUserIds: Array.from(allUserIds) })
          .select(["block.blockedUserId"])
          .getMany()
          .then((blocks) => new Set(blocks.map((b) => b.blockedUserId)))
      : new Set<number>();

    const messageMap = new Map(
      messages.map((message) => [
        message.id,
        this.transformMessage({
          ...message,
          isRead: message.isBroadcast
            ? broadcastReadSet.has(message.id)
            : message.isRead,
        } as Message, blockedUserIds),
      ]),
    );

    return {
      messages: messageIds
        .map((id) => messageMap.get(id))
        .filter(
          (
            message,
          ): message is ReturnType<MessageService["transformMessage"]> =>
            Boolean(message),
        ),
      total: totalCount,
    };
  }

  async findAllByUser(user: User, pagination: PaginationDto) {
    const { page, limit } = pagination;
    const { messages, total } = await this.getPagedMessages(
      user.id,
      page,
      limit,
    );

    return ListUtil.buildPaginatedList(messages, total, page, limit);
  }

  async findAll(queryDto: QueryMessageDto, user: User) {
    const {
      page,
      limit,
      type,
      isRead,
      isBroadcast,
      keyword,
      senderId,
      receiverId,
    } = queryDto;

    const { messages, total } = await this.getPagedMessages(
      user.id,
      page,
      limit,
      {
        type,
        isRead,
        isBroadcast,
        keyword,
        senderId,
        receiverId,
      },
    );

    return ListUtil.buildPaginatedList(messages, total, page, limit);
  }

  async findOne(id: number, user: User) {
    const message = await this.messageRepository.findOne({
      where: { id },
      relations: [...MessageService.MESSAGE_RELATIONS],
    });

    if (!message) {
      throw new NotFoundException("response.error.messageNotFound");
    }

    if (
      !message.isBroadcast &&
      message.receiverId !== user.id &&
      message.senderId !== user.id
    ) {
      throw new ForbiddenException("response.error.noPermissionViewMessage");
    }

    if (message.isBroadcast) {
      const readRecord = await this.messageReadRepository.findOne({
        where: { userId: user.id, messageId: id },
        select: ["id"],
      });
      message.isRead = !!readRecord;
    }

    // Get blocked user IDs for the current user
    const allUserIds = new Set<number>();
    if (message.senderId) allUserIds.add(message.senderId);
    if (message.receiverId) allUserIds.add(message.receiverId);

    const blockedUserIds = allUserIds.size > 0
      ? await this.userBlockRepository
          .createQueryBuilder("block")
          .where("block.userId = :userId", { userId: user.id })
          .andWhere("block.blockedUserId IN (:...allUserIds)", { allUserIds: Array.from(allUserIds) })
          .select(["block.blockedUserId"])
          .getMany()
          .then((blocks) => new Set(blocks.map((b) => b.blockedUserId)))
      : new Set<number>();

    return this.transformMessage(message, blockedUserIds);
  }

  async update(id: number, updateMessageDto: UpdateMessageDto, user: User) {
    const message = await this.findOne(id, user);

    if (
      message.senderId !== user.id &&
      !PermissionUtil.hasPermission(user, "message:manage")
    ) {
      throw new ForbiddenException("response.error.noPermissionUpdateMessage");
    }

    await this.messageRepository.update(id, updateMessageDto);
    const updatedMessage = await this.findOne(id, user);

    return {
      success: true,
      message: "response.success.messageUpdate",
      data: updatedMessage,
    };
  }

  async remove(id: number, user: User) {
    const message = await this.findOne(id, user);

    if (
      message.senderId !== user.id &&
      !PermissionUtil.hasPermission(user, "message:manage")
    ) {
      throw new ForbiddenException("response.error.noPermissionDeleteMessage");
    }

    await this.messageRepository.delete(id);
    return {
      success: true,
      message: "response.success.messageDelete",
    };
  }

  async markAsRead(id: number, user: User) {
    const message = await this.findOne(id, user);

    if (message.isBroadcast) {
      await this.messageReadRepository
        .createQueryBuilder()
        .insert()
        .into(MessageRead)
        .values({
          userId: user.id,
          messageId: id,
        })
        .orIgnore()
        .execute();
    } else {
      await this.messageRepository.update(id, { isRead: true });
    }

    return {
      success: true,
      message: "response.success.messageMarkAsRead",
    };
  }

  async markAllAsRead(markAllReadDto: MarkAllReadDto, user: User) {
    const { type, isBroadcast } = markAllReadDto;
    const userId = user.id;
    const readAt = new Date();

    if (type === "private") {
      await this.privateMessageRepository.update(
        {
          receiverId: userId,
          readAt: IsNull(),
          recalledAt: IsNull(),
        },
        { readAt },
      );

      return {
        success: true,
        message: "response.success.allMessagesMarkAsRead",
      };
    }

    if (isBroadcast) {
      const broadcastRows = await this.messageRepository
        .createQueryBuilder("message")
        .select("message.id", "id")
        .where("message.isBroadcast = true")
        .andWhere(type ? "message.type = :type" : "1 = 1", { type })
        .getRawMany();

      if (broadcastRows.length > 0) {
        await this.messageReadRepository
          .createQueryBuilder()
          .insert()
          .into(MessageRead)
          .values(
            broadcastRows.map((row) => ({
              userId,
              messageId: Number(row.id),
            })),
          )
          .orIgnore()
          .execute();
      }
    } else {
      const whereCondition: any = { receiverId: userId, isRead: false };
      if (type) {
        whereCondition.type = type;
      }

      await this.messageRepository.update(whereCondition, { isRead: true });
    }

    return {
      success: true,
      message: "response.success.allMessagesMarkAsRead",
    };
  }

  async batchOperation(batchMessageDto: BatchMessageDto, user: User) {
    const { messageIds, action } = batchMessageDto;

    const messages = await this.messageRepository.find({
      where: { id: In(messageIds) },
      select: ["id", "isBroadcast", "receiverId", "senderId"],
    });

    for (const message of messages) {
      if (
        !message.isBroadcast &&
        message.receiverId !== user.id &&
        message.senderId !== user.id
      ) {
        throw new ForbiddenException(
          "response.error.noPermissionBatchOperation",
        );
      }
    }

    if (action === "read") {
      const broadcastIds = messages
        .filter((message) => message.isBroadcast)
        .map((message) => message.id);
      const personalIds = messages
        .filter((message) => !message.isBroadcast)
        .map((message) => message.id);

      if (broadcastIds.length > 0) {
        await this.messageReadRepository
          .createQueryBuilder()
          .insert()
          .into(MessageRead)
          .values(
            broadcastIds.map((messageId) => ({
              userId: user.id,
              messageId,
            })),
          )
          .orIgnore()
          .execute();
      }

      if (personalIds.length > 0) {
        await this.messageRepository.update(
          { id: In(personalIds) },
          { isRead: true },
        );
      }
    } else if (action === "delete") {
      for (const message of messages) {
        if (
          message.senderId !== user.id &&
          !PermissionUtil.hasPermission(user, "message:manage")
        ) {
          throw new ForbiddenException(
            "response.error.noPermissionDeleteMessage",
          );
        }
      }
      await this.messageRepository.delete({ id: In(messageIds) });
    }

    return {
      success: true,
      message: `response.success.messages${action.charAt(0).toUpperCase() + action.slice(1)}`,
    };
  }

  async getUnreadCount(user: User) {
    const userId = user?.id;
    if (!userId) {
      return {
        personal: 0,
        notification: 0,
        direct: 0,
        system: 0,
        private: 0,
        broadcast: 0,
        total: 0,
      };
    }

    const [unreadMessageRows, privateUnreadCount, broadcastUnreadRow] =
      await Promise.all([
        this.messageRepository
          .createQueryBuilder("message")
          .select("message.type", "type")
          .addSelect("COUNT(*)", "count")
          .where("message.receiverId = :userId", { userId })
          .andWhere("message.isRead = false")
          .andWhere("message.isBroadcast = false")
          .groupBy("message.type")
          .getRawMany<{ type: Message["type"]; count: string }>(),
        this.privateMessageRepository.count({
          where: {
            receiverId: userId,
            readAt: IsNull(),
            recalledAt: IsNull(),
          },
        }),
        this.messageRepository
          .createQueryBuilder("message")
          .leftJoin(
            "message_read",
            "messageRead",
            "messageRead.messageId = message.id AND messageRead.userId = :userId",
            { userId },
          )
          .select("COUNT(message.id)", "count")
          .where("message.isBroadcast = true")
          .andWhere("messageRead.id IS NULL")
          .getRawOne(),
      ]);

    const unreadMessageCountMap = unreadMessageRows.reduce(
      (map, row) => {
        map[row.type] = Number(row.count || 0);
        return map;
      },
      {
        private: 0,
        system: 0,
        notification: 0,
      } as Record<Message["type"], number>,
    );

    const directUnreadCount = unreadMessageCountMap.private;
    const systemUnreadCount = unreadMessageCountMap.system;
    const notificationUnreadCount =
      unreadMessageCountMap.notification + systemUnreadCount;
    const broadcastUnreadCount = Number(broadcastUnreadRow?.count || 0);
    const personalUnreadCount =
      directUnreadCount + notificationUnreadCount + privateUnreadCount;

    return {
      personal: personalUnreadCount,
      notification: notificationUnreadCount,
      direct: directUnreadCount,
      system: systemUnreadCount,
      private: privateUnreadCount,
      broadcast: broadcastUnreadCount,
      total: personalUnreadCount + broadcastUnreadCount,
    };
  }

  private transformMessage(message: Message, blockedUserIds?: Set<number>) {
    const senderIsBlocked = message.sender?.id
      ? blockedUserIds?.has(message.sender.id) || false
      : false;
    const receiverIsBlocked = message.receiver?.id
      ? blockedUserIds?.has(message.receiver.id) || false
      : false;

    return {
      ...message,
      sender: message.sender
        ? sanitizeUser({
            ...processUserDecorations(message.sender),
            isBlocked: senderIsBlocked,
          })
        : null,
      receiver: message.receiver
        ? sanitizeUser({
            ...processUserDecorations(message.receiver),
            isBlocked: receiverIsBlocked,
          })
        : null,
      articleId: message.metadata?.articleId || null,
      commentId: message.metadata?.commentId || null,
      targetId: message.metadata?.targetId || null,
      targetType: message.metadata?.targetType || null,
      notificationType: message.metadata?.notificationType || null,
    };
  }
}
