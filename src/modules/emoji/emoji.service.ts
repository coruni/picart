import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In } from 'typeorm';
import { Emoji } from './entities/emoji.entity';
import { EmojiFavorite } from './entities/emoji-favorite.entity';
import { CreateEmojiDto } from './dto/create-emoji.dto';
import { UpdateEmojiDto } from './dto/update-emoji.dto';
import { QueryEmojiDto } from './dto/query-emoji.dto';
import { User } from '../user/entities/user.entity';
import { ListUtil } from 'src/common/utils/list.util';
import { PermissionUtil } from 'src/common/utils/permission.util';
import { sanitizeUser } from 'src/common/utils';

@Injectable()
export class EmojiService {
  constructor(
    @InjectRepository(Emoji)
    private readonly emojiRepository: Repository<Emoji>,
    @InjectRepository(EmojiFavorite)
    private readonly emojiFavoriteRepository: Repository<EmojiFavorite>,
  ) {}

  async create(createEmojiDto: CreateEmojiDto, user: User) {
    // 检查是否有权限创建系统表情
    if (
      createEmojiDto.type === 'system' &&
      !PermissionUtil.hasPermission(user, 'emoji:manage')
    ) {
      throw new ForbiddenException('response.error.noPermissionCreateSystemEmoji');
    }

    // 检查表情代码是否已存在
    if (createEmojiDto.code) {
      const existingEmoji = await this.emojiRepository.findOne({
        where: { code: createEmojiDto.code },
      });
      if (existingEmoji) {
        throw new BadRequestException('response.error.emojiCodeExists');
      }
    }

    const emoji = this.emojiRepository.create({
      ...createEmojiDto,
      userId: createEmojiDto.type === 'system' ? null : user.id,
      type: createEmojiDto.type || 'user',
    });

    const savedEmoji = await this.emojiRepository.save(emoji);

    return {
      success: true,
      message: 'response.success.emojiCreate',
      data: savedEmoji,
    };
  }

  async findAll(queryDto: QueryEmojiDto, user?: User) {
    const {
      page,
      limit,
      type,
      category,
      keyword,
      isPublic,
      status,
      userId,
      onlyFavorites,
    } = queryDto;

    const queryBuilder = this.emojiRepository
      .createQueryBuilder('emoji')
      .leftJoinAndSelect('emoji.user', 'user');

    // 基础筛选条件
    if (type) {
      queryBuilder.andWhere('emoji.type = :type', { type });
    }

    if (category) {
      queryBuilder.andWhere('emoji.category = :category', { category });
    }

    if (status) {
      queryBuilder.andWhere('emoji.status = :status', { status });
    } else {
      // 默认只显示激活的表情
      queryBuilder.andWhere('emoji.status = :status', { status: 'active' });
    }

    // 关键词搜索
    if (keyword) {
      queryBuilder.andWhere(
        '(emoji.name LIKE :keyword OR emoji.tags LIKE :keyword OR emoji.code LIKE :keyword)',
        { keyword: `%${keyword}%` },
      );
    }

    // 公开性筛选
    if (isPublic !== undefined) {
      queryBuilder.andWhere('emoji.isPublic = :isPublic', { isPublic });
    }

    // 用户筛选
    if (userId) {
      queryBuilder.andWhere('emoji.userId = :userId', { userId: parseInt(userId) });
    }

    // 只查询收藏的表情
    if (onlyFavorites && user) {
      const favorites = await this.emojiFavoriteRepository.find({
        where: { userId: user.id },
        select: ['emojiId'],
      });
      const favoriteIds = favorites.map((f) => f.emojiId);
      
      if (favoriteIds.length > 0) {
        queryBuilder.andWhere('emoji.id IN (:...favoriteIds)', { favoriteIds });
      } else {
        // 没有收藏，返回空结果
        return ListUtil.buildPaginatedList([], 0, page, limit);
      }
    }

    // 权限控制：非管理员只能看到公开的表情和自己的表情
    if (!user || !PermissionUtil.hasPermission(user, 'emoji:manage')) {
      queryBuilder.andWhere(
        '(emoji.isPublic = :isPublic OR emoji.userId = :currentUserId OR emoji.type = :systemType)',
        {
          isPublic: true,
          currentUserId: user?.id || null,
          systemType: 'system',
        },
      );
    }

    // 排序
    queryBuilder.orderBy('emoji.useCount', 'DESC');
    queryBuilder.addOrderBy('emoji.createdAt', 'DESC');

    // 分页
    const [emojis, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // 处理用户敏感信息
    const processedEmojis = emojis.map((emoji) => ({
      ...emoji,
      user: emoji.user ? sanitizeUser(emoji.user) : null,
    }));

    // 如果有用户，标记收藏状态
    if (user) {
      const favorites = await this.emojiFavoriteRepository.find({
        where: {
          userId: user.id,
          emojiId: In(processedEmojis.map((e) => e.id)),
        },
      });
      const favoriteIds = new Set(favorites.map((f) => f.emojiId));

      processedEmojis.forEach((emoji: any) => {
        emoji.isFavorite = favoriteIds.has(emoji.id);
      });
    }

    return ListUtil.buildPaginatedList(processedEmojis, total, page, limit);
  }

  async findOne(id: number, user?: User) {
    const emoji = await this.emojiRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!emoji) {
      throw new NotFoundException('response.error.emojiNotFound');
    }

    // 权限检查
    if (
      !emoji.isPublic &&
      emoji.type !== 'system' &&
      (!user || (emoji.userId !== user.id && !PermissionUtil.hasPermission(user, 'emoji:manage')))
    ) {
      throw new ForbiddenException('response.error.noPermissionViewEmoji');
    }

    // 处理用户敏感信息
    const processedEmoji: any = {
      ...emoji,
      user: emoji.user ? sanitizeUser(emoji.user) : null,
    };

    // 标记收藏状态
    if (user) {
      const favorite = await this.emojiFavoriteRepository.findOne({
        where: { userId: user.id, emojiId: id },
      });
      processedEmoji.isFavorite = !!favorite;
    }

    return processedEmoji;
  }

  async update(id: number, updateEmojiDto: UpdateEmojiDto, user: User) {
    const emoji = await this.emojiRepository.findOne({ where: { id } });

    if (!emoji) {
      throw new NotFoundException('response.error.emojiNotFound');
    }

    // 权限检查
    if (
      emoji.userId !== user.id &&
      !PermissionUtil.hasPermission(user, 'emoji:manage')
    ) {
      throw new ForbiddenException('response.error.noPermissionUpdateEmoji');
    }

    // 检查表情代码是否已被其他表情使用
    if (updateEmojiDto.code && updateEmojiDto.code !== emoji.code) {
      const existingEmoji = await this.emojiRepository.findOne({
        where: { code: updateEmojiDto.code },
      });
      if (existingEmoji && existingEmoji.id !== id) {
        throw new BadRequestException('response.error.emojiCodeExists');
      }
    }

    await this.emojiRepository.update(id, updateEmojiDto);
    const updatedEmoji = await this.findOne(id, user);

    return {
      success: true,
      message: 'response.success.emojiUpdate',
      data: updatedEmoji,
    };
  }

  async remove(id: number, user: User) {
    const emoji = await this.emojiRepository.findOne({ where: { id } });

    if (!emoji) {
      throw new NotFoundException('response.error.emojiNotFound');
    }

    // 权限检查
    if (
      emoji.userId !== user.id &&
      !PermissionUtil.hasPermission(user, 'emoji:manage')
    ) {
      throw new ForbiddenException('response.error.noPermissionDeleteEmoji');
    }

    // 软删除
    await this.emojiRepository.update(id, { status: 'deleted' });

    return {
      success: true,
      message: 'response.success.emojiDelete',
    };
  }

  async addToFavorites(emojiId: number, user: User) {
    const emoji = await this.emojiRepository.findOne({ where: { id: emojiId } });

    if (!emoji) {
      throw new NotFoundException('response.error.emojiNotFound');
    }

    // 检查是否已收藏
    const existingFavorite = await this.emojiFavoriteRepository.findOne({
      where: { userId: user.id, emojiId },
    });

    if (existingFavorite) {
      throw new BadRequestException('response.error.emojiAlreadyFavorited');
    }

    await this.emojiFavoriteRepository.save({
      userId: user.id,
      emojiId,
    });

    return {
      success: true,
      message: 'response.success.emojiAddToFavorites',
    };
  }

  async removeFromFavorites(emojiId: number, user: User) {
    const favorite = await this.emojiFavoriteRepository.findOne({
      where: { userId: user.id, emojiId },
    });

    if (!favorite) {
      throw new NotFoundException('response.error.emojiFavoriteNotFound');
    }

    await this.emojiFavoriteRepository.delete(favorite.id);

    return {
      success: true,
      message: 'response.success.emojiRemoveFromFavorites',
    };
  }

  async getFavorites(user: User, page: number = 1, limit: number = 20) {
    const favorites = await this.emojiFavoriteRepository.find({
      where: { userId: user.id },
      relations: ['emoji', 'emoji.user'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const total = await this.emojiFavoriteRepository.count({
      where: { userId: user.id },
    });

    const emojis = favorites.map((f) => ({
      ...f.emoji,
      user: f.emoji.user ? sanitizeUser(f.emoji.user) : null,
      isFavorite: true,
      favoritedAt: f.createdAt,
    }));

    return ListUtil.buildPaginatedList(emojis, total, page, limit);
  }

  async incrementUseCount(id: number) {
    await this.emojiRepository.increment({ id }, 'useCount', 1);
  }

  async getCategories() {
    const result = await this.emojiRepository
      .createQueryBuilder('emoji')
      .select('emoji.category', 'category')
      .addSelect('COUNT(*)', 'count')
      .where('emoji.status = :status', { status: 'active' })
      .andWhere('emoji.category IS NOT NULL')
      .groupBy('emoji.category')
      .orderBy('count', 'DESC')
      .getRawMany();

    return result;
  }

  async getPopular(limit: number = 20) {
    const emojis = await this.emojiRepository.find({
      where: { status: 'active', isPublic: true },
      relations: ['user'],
      order: { useCount: 'DESC' },
      take: limit,
    });

    return emojis.map((emoji) => ({
      ...emoji,
      user: emoji.user ? sanitizeUser(emoji.user) : null,
    }));
  }

  async getRecent(user: User, limit: number = 20) {
    const emojis = await this.emojiRepository.find({
      where: { userId: user.id, status: 'active' },
      relations: ['user'],
      order: { createdAt: 'DESC' },
      take: limit,
    });

    return emojis.map((emoji) => ({
      ...emoji,
      user: emoji.user ? sanitizeUser(emoji.user) : null,
    }));
  }
}
