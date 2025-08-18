import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Message } from './entities/message.entity';
import { MessageRead } from './entities/message-read.entity';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { ForbiddenException } from '@nestjs/common';
import { ListUtil } from 'src/common/utils/list.util';
import { PermissionUtil } from 'src/common/utils/permission.util';
import { User } from '../user/entities/user.entity';
import { PaginationDto } from 'src/common/dto/pagination.dto';

@Injectable()
export class MessageService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(MessageRead)
    private readonly messageReadRepository: Repository<MessageRead>,
  ) {}

  async create(createMessageDto: CreateMessageDto, user: User) {
    // 仅全员通知校验权限
    if (createMessageDto.isBroadcast) {
      if (!PermissionUtil.hasPermission(user, 'message:create')) {
        throw new ForbiddenException('response.error.noPermissionSendBroadcast');
      }
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
        message: 'response.success.messageCreate',
        data: savedMessage,
      };
    }
    // 批量部分用户
    if (createMessageDto.receiverIds && createMessageDto.receiverIds.length > 0) {
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
        message: 'response.success.messageCreate',
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
      message: 'response.success.messageCreate',
      data: savedMessage,
    };
  }

  async findAllByUser(user: User, pagination: PaginationDto) {
    const userId = user.id;
    const { page, limit } = pagination;
    // 查询全员通知
    const broadcastMessages = await this.messageRepository.find({
      where: { isBroadcast: true },
      order: { createdAt: 'DESC' },
    });
    // 查询个人消息
    const personalMessages = await this.messageRepository.find({
      where: { receiverId: userId },
      order: { createdAt: 'DESC' },
    });
    // 查询已读记录
    const readRecords = await this.messageReadRepository.find({
      where: { userId },
    });
    const readMessageIds = new Set(readRecords.map((r) => r.messageId));
    // 合并并标记已读
    const allMessages = [...broadcastMessages, ...personalMessages].map((msg) => ({
      ...msg,
      isRead: msg.isBroadcast ? readMessageIds.has(msg.id) : msg.isRead,
    }));
    // 分页
    const start = (page - 1) * limit;
    const end = start + limit;
    const pagedMessages = allMessages.slice(start, end);
    return ListUtil.buildPaginatedList(pagedMessages, allMessages.length, page, limit);
  }

  async findOne(id: number) {
    return this.messageRepository.findOne({ where: { id } });
  }

  async update(id: number, updateMessageDto: UpdateMessageDto) {
    await this.messageRepository.update(id, updateMessageDto);
    const updatedMessage = await this.findOne(id);
    return {
      success: true,
      message: 'response.success.messageUpdate',
      data: updatedMessage,
    };
  }

  async remove(id: number) {
    await this.messageRepository.delete(id);
    return { success: true, message: 'response.success.messageDelete' };
  }

  async markAsRead(id: number, user: User) {
    const userId = user.id;
    const message = await this.findOne(id);
    if (!message) return;
    if (message.isBroadcast) {
      // 全员通知，插入 message_read
      const exist = await this.messageReadRepository.findOne({ where: { userId, messageId: id } });
      if (!exist) {
        await this.messageReadRepository.save({ userId, messageId: id });
      }
    } else {
      // 普通消息，直接更新
      await this.messageRepository.update(id, { isRead: true });
    }
  }
}
