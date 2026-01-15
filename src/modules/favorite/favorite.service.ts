import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateFavoriteDto } from './dto/create-favorite.dto';
import { UpdateFavoriteDto } from './dto/update-favorite.dto';
import { AddToFavoriteDto } from './dto/add-to-favorite.dto';
import { QueryFavoriteDto } from './dto/query-favorite.dto';
import { Favorite } from './entities/favorite.entity';
import { FavoriteItem } from './entities/favorite-item.entity';
import { User } from '../user/entities/user.entity';
import { UserConfig } from '../user/entities/user-config.entity';
import { Article } from '../article/entities/article.entity';
import { ConfigService } from '../config/config.service';
import { PointsService } from '../points/points.service';
import { ListUtil, sanitizeUser, processUserDecorations } from '../../common/utils';
import { PaginationDto } from 'src/common/dto/pagination.dto';

@Injectable()
export class FavoriteService {
  constructor(
    @InjectRepository(Favorite)
    private favoriteRepository: Repository<Favorite>,
    @InjectRepository(FavoriteItem)
    private favoriteItemRepository: Repository<FavoriteItem>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(UserConfig)
    private userConfigRepository: Repository<UserConfig>,
    @InjectRepository(Article)
    private articleRepository: Repository<Article>,
    private configService: ConfigService,
    private pointsService: PointsService,
  ) { }

  /**
   * 创建收藏夹
   */
  async create(userId: number, createFavoriteDto: CreateFavoriteDto) {
    // 检查用户收藏夹数量
    const userFavoriteCount = await this.favoriteRepository.count({
      where: { userId },
    });

    const maxFreeFavorites = await this.configService.getCachedConfig(
      'favorite_max_free_count',
      6,
    );

    // 如果超过免费数量，需要扣除积分
    if (userFavoriteCount >= maxFreeFavorites) {
      const createCost = await this.configService.getCachedConfig(
        'favorite_create_cost',
        10,
      );

      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException('response.error.userNotExist');
      }

      if (user.score < createCost) {
        throw new BadRequestException('response.error.insufficientPoints');
      }

      // 扣除积分
      await this.pointsService.spendPoints(userId, {
        amount: createCost,
        source: 'CREATE_FAVORITE',
        description: `创建收藏夹：${createFavoriteDto.name}`,
        relatedType: 'FAVORITE',
      });
    }

    const favorite = this.favoriteRepository.create({
      ...createFavoriteDto,
      userId,
    });

    const savedFavorite = await this.favoriteRepository.save(favorite);

    return {
      success: true,
      message: 'response.success.favoriteCreate',
      data: savedFavorite,
    };
  }

  /**
   * 获取用户的收藏夹列表
   */
  async findAll(userId: number, queryDto: QueryFavoriteDto) {
    const { page = 1, limit = 10, userId: targetUserId } = queryDto;

    const actualTargetUserId = targetUserId || userId;

    // 如果查询的不是自己的收藏夹，需要检查目标用户的隐私设置
    if (actualTargetUserId && actualTargetUserId !== userId) {
      const targetUserConfig = await this.userConfigRepository.findOne({
        where: { userId: actualTargetUserId },
      });

      // 如果用户设置了隐藏收藏夹，则不允许查看
      if (targetUserConfig?.hideFavorites) {
        throw new ForbiddenException('response.error.favoritesHidden');
      }
    }

    const queryBuilder = this.favoriteRepository
      .createQueryBuilder('favorite')
      .leftJoinAndSelect('favorite.user', 'user')
      .leftJoinAndSelect('user.userDecorations', 'userDecorations')
      .leftJoinAndSelect('userDecorations.decoration', 'decoration')
      .where('favorite.userId = :targetUserId', {
        targetUserId: actualTargetUserId,
      });

    // 如果查询的不是自己的收藏夹，只显示公开的
    if (actualTargetUserId && actualTargetUserId !== userId) {
      queryBuilder.andWhere('favorite.isPublic = :isPublic', { isPublic: true });
    }

    queryBuilder.orderBy('favorite.sort', 'ASC').addOrderBy('favorite.createdAt', 'DESC');

    const [data, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // 对用户信息脱敏
    const sanitizedData = data.map(favorite => ({
      ...favorite,
      user: favorite.user ? sanitizeUser(processUserDecorations(favorite.user)) : null,
    }));

    return ListUtil.buildPaginatedList(sanitizedData, total, page, limit);
  }

  /**
   * 获取收藏夹详情
   */
  async findOne(id: number, userId?: number) {
    const favorite = await this.favoriteRepository.findOne({
      where: { id },
      relations: ['user', 'user.userDecorations', 'user.userDecorations.decoration'],
    });

    if (!favorite) {
      throw new NotFoundException('response.error.favoriteNotFound');
    }

    // 如果不是所有者，需要检查权限
    if (userId && favorite.userId !== userId) {
      // 检查收藏夹是否公开
      if (!favorite.isPublic) {
        throw new ForbiddenException('response.error.favoriteNotPublic');
      }

      // 检查用户是否隐藏了收藏夹
      const userConfig = await this.userConfigRepository.findOne({
        where: { userId: favorite.userId },
      });

      if (userConfig?.hideFavorites) {
        throw new ForbiddenException('response.error.favoritesHidden');
      }
    }

    // 对用户信息脱敏
    return {
      ...favorite,
      user: favorite.user ? sanitizeUser(processUserDecorations(favorite.user)) : null,
    };
  }

  /**
   * 更新收藏夹
   */
  async update(id: number, userId: number, updateFavoriteDto: UpdateFavoriteDto) {
    const favorite = await this.favoriteRepository.findOne({ where: { id } });

    if (!favorite) {
      throw new NotFoundException('response.error.favoriteNotFound');
    }

    if (favorite.userId !== userId) {
      throw new ForbiddenException('response.error.noPermission');
    }

    Object.assign(favorite, updateFavoriteDto);
    const updatedFavorite = await this.favoriteRepository.save(favorite);

    return {
      success: true,
      message: 'response.success.favoriteUpdate',
      data: updatedFavorite,
    };
  }

  /**
   * 删除收藏夹
   */
  async remove(id: number, userId: number) {
    const favorite = await this.favoriteRepository.findOne({ where: { id } });

    if (!favorite) {
      throw new NotFoundException('response.error.favoriteNotFound');
    }

    if (favorite.userId !== userId) {
      throw new ForbiddenException('response.error.noPermission');
    }

    await this.favoriteRepository.remove(favorite);

    return {
      success: true,
      message: 'response.success.favoriteDelete',
    };
  }

  /**
   * 添加文章到收藏夹
   */
  async addToFavorite(userId: number, addToFavoriteDto: AddToFavoriteDto) {
    const { favoriteId, articleId, note } = addToFavoriteDto;

    // 检查收藏夹是否存在且属于当前用户
    const favorite = await this.favoriteRepository.findOne({
      where: { id: favoriteId },
    });

    if (!favorite) {
      throw new NotFoundException('response.error.favoriteNotFound');
    }

    if (favorite.userId !== userId) {
      throw new ForbiddenException('response.error.noPermission');
    }

    // 检查文章是否存在
    const article = await this.articleRepository.findOne({
      where: { id: articleId },
      relations: ['author'],
    });

    if (!article) {
      throw new NotFoundException('response.error.articleNotExist');
    }

    // 检查是否已经收藏
    const existingItem = await this.favoriteItemRepository.findOne({
      where: { favoriteId, articleId },
    });

    if (existingItem) {
      throw new BadRequestException('response.error.alreadyInFavorite');
    }

    // 获取当前收藏夹中的最大排序值
    const maxSort = await this.favoriteItemRepository
      .createQueryBuilder('item')
      .select('MAX(item.sort)', 'maxSort')
      .where('item.favoriteId = :favoriteId', { favoriteId })
      .getRawOne();

    const favoriteItem = this.favoriteItemRepository.create({
      favoriteId,
      articleId,
      userId,
      note,
      sort: (maxSort?.maxSort || 0) + 1,
    });

    await this.favoriteItemRepository.save(favoriteItem);

    // 更新收藏夹的收藏数量
    favorite.itemCount += 1;
    await this.favoriteRepository.save(favorite);

    return {
      success: true,
      message: 'response.success.addToFavorite',
      data: favoriteItem,
    };
  }

  /**
   * 从收藏夹移除文章
   */
  async removeFromFavorite(userId: number, favoriteId: number, articleId: number) {
    const favorite = await this.favoriteRepository.findOne({
      where: { id: favoriteId },
    });

    if (!favorite) {
      throw new NotFoundException('response.error.favoriteNotFound');
    }

    if (favorite.userId !== userId) {
      throw new ForbiddenException('response.error.noPermission');
    }

    const favoriteItem = await this.favoriteItemRepository.findOne({
      where: { favoriteId, articleId },
    });

    if (!favoriteItem) {
      throw new NotFoundException('response.error.favoriteItemNotFound');
    }

    await this.favoriteItemRepository.remove(favoriteItem);

    // 更新收藏夹的收藏数量
    favorite.itemCount = Math.max(0, favorite.itemCount - 1);
    await this.favoriteRepository.save(favorite);

    return {
      success: true,
      message: 'response.success.removeFromFavorite',
    };
  }

  /**
   * 获取收藏夹中的文章列表
   */
  async getFavoriteItems(favoriteId: number, userId: number, pagination: PaginationDto) {
    const { page, limit } = pagination;
    await this.findOne(favoriteId, userId);

    const queryBuilder = this.favoriteItemRepository
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.article', 'article')
      .leftJoinAndSelect('article.author', 'author')
      .leftJoinAndSelect('author.userDecorations', 'authorDecorations')
      .leftJoinAndSelect('authorDecorations.decoration', 'authorDecoration')
      .leftJoinAndSelect('article.category', 'category')
      .leftJoinAndSelect('article.tags', 'tags')
      .where('item.favoriteId = :favoriteId', { favoriteId })
      .orderBy('item.sort', 'ASC')
      .addOrderBy('item.createdAt', 'DESC');

    const [items, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // 为每个项目添加上一篇和下一篇信息，并对作者信息脱敏
    const itemsWithNavigation = await Promise.all(
      items.map(async (item) => {
        // 获取上一篇
        const prevItem = await this.favoriteItemRepository
          .createQueryBuilder('item')
          .leftJoinAndSelect('item.article', 'article')
          .where('item.favoriteId = :favoriteId', { favoriteId })
          .andWhere('item.sort < :sort', { sort: item.sort })
          .orderBy('item.sort', 'DESC')
          .getOne();

        // 获取下一篇
        const nextItem = await this.favoriteItemRepository
          .createQueryBuilder('item')
          .leftJoinAndSelect('item.article', 'article')
          .where('item.favoriteId = :favoriteId', { favoriteId })
          .andWhere('item.sort > :sort', { sort: item.sort })
          .orderBy('item.sort', 'ASC')
          .getOne();

        return {
          ...item,
          article: item.article ? {
            ...item.article,
            author: item.article.author ? sanitizeUser(processUserDecorations(item.article.author)) : null,
          } : null,
          prev: prevItem
            ? {
              id: prevItem.article.id,
              title: prevItem.article.title,
              cover: prevItem.article.cover,
            }
            : null,
          next: nextItem
            ? {
              id: nextItem.article.id,
              title: nextItem.article.title,
              cover: nextItem.article.cover,
            }
            : null,
        };
      }),
    );

    return ListUtil.buildPaginatedList(itemsWithNavigation, total, page, limit);
  }

  /**
   * 检查文章是否在用户的收藏夹中
   */
  async checkArticleInFavorites(userId: number, articleId: number) {
    const items = await this.favoriteItemRepository.find({
      where: { userId, articleId },
      relations: ['favorite'],
    });

    return {
      inFavorites: items.length > 0,
      favorites: items.map((item) => ({
        id: item.favorite.id,
        name: item.favorite.name,
      })),
    };
  }

  /**
   * 获取文章所在的收藏夹信息（用于文章详情页）
   */
  async getArticleFavoriteInfo(userId: number, articleId: number) {
    if (!userId) {
      return null;
    }

    const items = await this.favoriteItemRepository.find({
      where: { userId, articleId },
      relations: ['favorite'],
      order: { createdAt: 'DESC' },
    });

    if (items.length === 0) {
      return null;
    }

    return items.map((item) => ({
      favoriteId: item.favorite.id,
      favoriteName: item.favorite.name,
      note: item.note,
      addedAt: item.createdAt,
    }));
  }
}
