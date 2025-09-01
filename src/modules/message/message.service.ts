import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In, Like } from "typeorm";
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
import { sanitizeUser } from "src/common/utils";

@Injectable()
export class MessageService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(MessageRead)
    private readonly messageReadRepository: Repository<MessageRead>,
  ) {}

  async create(createMessageDto: CreateMessageDto, user: User) {
    // 广播消息需要管理员权限
    if (
      createMessageDto.isBroadcast &&
      !PermissionUtil.hasPermission(user, "message:create")
    ) {
      throw new ForbiddenException("response.error.noPermissionSendBroadcast");
    }

    // 全员通知
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

    // 批量部分用户
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

    // 单发
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

  async findAllByUser(user: User, pagination: PaginationDto) {
    const userId = user.id;
    const { page, limit } = pagination;

    // 查询全员通知
    const broadcastMessages = await this.messageRepository.find({
      where: { isBroadcast: true },
      relations: ["sender"],
      order: { createdAt: "DESC" },
    });

    // 查询个人消息
    const personalMessages = await this.messageRepository.find({
      where: { receiverId: userId },
      relations: ["sender", "receiver"],
      order: { createdAt: "DESC" },
    });

    // 查询已读记录
    const readRecords = await this.messageReadRepository.find({
      where: { userId },
    });
    const readMessageIds = new Set(readRecords.map((r) => r.messageId));

    // 合并并标记已读
    const allMessages = [...broadcastMessages, ...personalMessages].map(
      (msg) => ({
        ...msg,
        isRead: msg.isBroadcast ? readMessageIds.has(msg.id) : msg.isRead,
      }),
    );

    // 分页
    const start = (page - 1) * limit;
    const end = start + limit;
    const pagedMessages = allMessages.slice(start, end);

    // 处理用户敏感信息
    const processedMessages = pagedMessages.map((msg) => ({
      ...msg,
      sender: sanitizeUser(msg.sender),
      receiver: sanitizeUser(msg.receiver),
    }));

    return ListUtil.buildPaginatedList(
      processedMessages,
      allMessages.length,
      page,
      limit,
    );
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
    const userId = user.id;

    // 构建查询条件
    const whereConditions: any[] = [];

    // 用户只能查看自己的消息或广播消息
    whereConditions.push({ receiverId: userId }, { isBroadcast: true });

    if (type) {
      whereConditions.forEach((condition) => (condition.type = type));
    }

    if (isRead !== undefined) {
      whereConditions.forEach((condition) => (condition.isRead = isRead));
    }

    if (isBroadcast !== undefined) {
      whereConditions.forEach(
        (condition) => (condition.isBroadcast = isBroadcast),
      );
    }

    if (senderId) {
      whereConditions.forEach((condition) => (condition.senderId = senderId));
    }

    if (receiverId) {
      whereConditions.forEach(
        (condition) => (condition.receiverId = receiverId),
      );
    }

    // 关键词搜索
    if (keyword) {
      whereConditions.forEach((condition) => {
        condition.content = Like(`%${keyword}%`);
      });
    }

    const [messages, total] = await this.messageRepository.findAndCount({
      where: whereConditions,
      relations: ["sender", "receiver"],
      order: { createdAt: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
    });

    // 处理已读状态
    const readRecords = await this.messageReadRepository.find({
      where: { userId },
    });
    const readMessageIds = new Set(readRecords.map((r) => r.messageId));

    const processedMessages = messages.map((msg) => ({
      ...msg,
      isRead: msg.isBroadcast ? readMessageIds.has(msg.id) : msg.isRead,
      sender: sanitizeUser(msg.sender),
      receiver: sanitizeUser(msg.receiver),
    }));

    return ListUtil.buildPaginatedList(processedMessages, total, page, limit);
  }

  async findOne(id: number, user: User) {
    const message = await this.messageRepository.findOne({
      where: { id },
      relations: ["sender", "receiver"],
    });


    if (!message) {
      throw new NotFoundException("response.error.messageNotFound");
    }

    // 检查权限：用户只能查看自己的消息或广播消息
    if (
      !message.isBroadcast &&
      message.receiverId !== user.id &&
      message.senderId !== user.id
    ) {
      throw new ForbiddenException("response.error.noPermissionViewMessage");
    }

    // 处理已读状态
    if (message.isBroadcast) {
      const readRecord = await this.messageReadRepository.findOne({
        where: { userId: user.id, messageId: id },
      });
      message.isRead = !!readRecord;
    }

    return message;
  }

  async update(id: number, updateMessageDto: UpdateMessageDto, user: User) {
    const message = await this.findOne(id, user);

    // 检查权限：只有发送者或管理员可以修改消息
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

    // 检查权限：只有发送者或管理员可以删除消息
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
      // 全员通知，插入 message_read
      const exist = await this.messageReadRepository.findOne({
        where: { userId: user.id, messageId: id },
      });
      if (!exist) {
        await this.messageReadRepository.save({
          userId: user.id,
          messageId: id,
        });
      }
    } else {
      // 普通消息，直接更新
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

    if (isBroadcast) {
      // 标记所有广播消息为已读
      const broadcastMessages = await this.messageRepository.find({
        where: { isBroadcast: true, ...(type && { type }) },
      });

      const readRecords = broadcastMessages.map((msg) => ({
        userId,
        messageId: msg.id,
      }));

      await this.messageReadRepository.save(readRecords);
    } else {
      // 标记个人消息为已读
      const whereCondition: any = { receiverId: userId, isRead: false };
      if (type) whereCondition.type = type;

      await this.messageRepository.update(whereCondition, { isRead: true });
    }

    return {
      success: true,
      message: "response.success.allMessagesMarkAsRead",
    };
  }

  async batchOperation(batchMessageDto: BatchMessageDto, user: User) {
    const { messageIds, action } = batchMessageDto;

    // 验证消息权限
    const messages = await this.messageRepository.find({
      where: { id: In(messageIds) },
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
      // 批量标记为已读
      for (const message of messages) {
        if (message.isBroadcast) {
          const exist = await this.messageReadRepository.findOne({
            where: { userId: user.id, messageId: message.id },
          });
          if (!exist) {
            await this.messageReadRepository.save({
              userId: user.id,
              messageId: message.id,
            });
          }
        } else {
          await this.messageRepository.update(message.id, { isRead: true });
        }
      }
    } else if (action === "delete") {
      // 批量删除
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
    const userId = user.id;

    // 统计个人未读消息
    const personalUnreadCount = await this.messageRepository.count({
      where: { receiverId: userId, isRead: false },
    });

    // 统计广播未读消息
    const broadcastMessages = await this.messageRepository.find({
      where: { isBroadcast: true },
      select: ["id"],
    });

    const readBroadcastIds = await this.messageReadRepository.find({
      where: { userId },
      select: ["messageId"],
    });

    const readBroadcastSet = new Set(readBroadcastIds.map((r) => r.messageId));
    const broadcastUnreadCount = broadcastMessages.filter(
      (msg) => !readBroadcastSet.has(msg.id),
    ).length;

    return {
      success: true,
      data: {
        personal: personalUnreadCount,
        broadcast: broadcastUnreadCount,
        total: personalUnreadCount + broadcastUnreadCount,
      },
    };
  }

  async getMessageStats(user: User) {
    const userId = user.id;

    // 统计各种类型的消息数量
    const typeStats = await this.messageRepository
      .createQueryBuilder("message")
      .select("message.type", "type")
      .addSelect("COUNT(*)", "count")
      .where(
        "message.receiverId = :userId OR message.isBroadcast = :isBroadcast",
        {
          userId,
          isBroadcast: true,
        },
      )
      .groupBy("message.type")
      .getRawMany();

    // 统计未读消息数量
    const personalUnreadCount = await this.messageRepository.count({
      where: { receiverId: userId, isRead: false },
    });

    const broadcastMessages = await this.messageRepository.find({
      where: { isBroadcast: true },
      select: ["id"],
    });

    const readBroadcastIds = await this.messageReadRepository.find({
      where: { userId },
      select: ["messageId"],
    });

    const readBroadcastSet = new Set(readBroadcastIds.map((r) => r.messageId));
    const broadcastUnreadCount = broadcastMessages.filter(
      (msg) => !readBroadcastSet.has(msg.id),
    ).length;

    // 统计总消息数量
    const totalMessages = await this.messageRepository.count({
      where: [
        { receiverId: userId },
        { isBroadcast: true }
      ]
    });

    return {
      success: true,
      data: {
        // 按类型统计
        typeStats: typeStats.map(stat => ({
          type: stat.type,
          count: parseInt(stat.count)
        })),
        // 未读消息统计
        unread: {
          personal: personalUnreadCount,
          broadcast: broadcastUnreadCount,
          total: personalUnreadCount + broadcastUnreadCount,
        },
        // 总体统计
        total: {
          messages: totalMessages,
          read: totalMessages - (personalUnreadCount + broadcastUnreadCount),
          unread: personalUnreadCount + broadcastUnreadCount,
        }
      },
    };
  }
}
