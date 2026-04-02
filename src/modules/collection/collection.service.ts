import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { QueryCollectionDto } from './dto/query-collection.dto';
import { Collection } from './entities/collection.entity';
import { CollectionItem } from './entities/collection-item.entity';
import { User } from '../user/entities/user.entity';
import { UserConfig } from '../user/entities/user-config.entity';
import { Article } from '../article/entities/article.entity';
import { ConfigService } from '../config/config.service';
import { PointsService } from '../points/points.service';
import { ListUtil, PermissionUtil, sanitizeUser, processUserDecorations } from '../../common/utils';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { ArticlePresentationService } from '../article/article-presentation.service';

@Injectable()
export class CollectionService {
  constructor(
    @InjectRepository(Collection)
    private collectionRepository: Repository<Collection>,
    @InjectRepository(CollectionItem)
    private collectionItemRepository: Repository<CollectionItem>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(UserConfig)
    private userConfigRepository: Repository<UserConfig>,
    @InjectRepository(Article)
    private articleRepository: Repository<Article>,
    private configService: ConfigService,
    private pointsService: PointsService,
    private articlePresentationService: ArticlePresentationService,
  ) { }

  private canBypassUserVisibility(targetUserId: number, currentUser?: User) {
    if (!currentUser) {
      return false;
    }

    return (
      currentUser.id === targetUserId ||
      PermissionUtil.hasPermission(currentUser, 'user:manage')
    );
  }

  private async buildSanitizedUser(userId: number) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['userDecorations', 'userDecorations.decoration'],
    });

    return user ? sanitizeUser(processUserDecorations(user)) : null;
  }

  /**
   * 创建收藏夹
   */
  async create(userId: number, createCollectionDto: CreateCollectionDto) {
    // 检查用户收藏夹数量
    const userCollectionCount = await this.collectionRepository.count({
      where: { userId },
    });

    const maxFreeFavorites = await this.configService.getCachedConfig(
      'favorite_max_free_count',
      6,
    );

    // 如果超过免费数量，需要扣除积分
    if (userCollectionCount >= maxFreeFavorites) {
      const createCost = await this.configService.getCachedConfig(
        'favorite_create_cost',
        10,
      );

      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException('response.error.userNotExist');
      }

      if (user.points < createCost) {
        throw new BadRequestException('response.error.insufficientPoints');
      }

      // 扣除积分
      await this.pointsService.spendPoints(userId, {
        amount: createCost,
        source: 'CREATE_FAVORITE',
        description: `创建收藏夹：${createCollectionDto.name}`,
        relatedType: 'FAVORITE',
      });
    }

    const collection = this.collectionRepository.create({
      ...createCollectionDto,
      userId,
    });

    const savedCollection = await this.collectionRepository.save(collection);

    return {
      success: true,
      message: 'response.success.favoriteCreate',
      data: savedCollection,
    };
  }

  /**
   * 获取用户的收藏夹列表
   */
  async findAll(currentUser: User, queryDto: QueryCollectionDto) {
    const { page = 1, limit = 10, userId: targetUserId, keyword, sortBy, sortOrder } = queryDto;

    const actualTargetUserId = targetUserId || currentUser.id;

    // 目标用户开启隐藏合集时，直接返回空列表
    if (actualTargetUserId) {
      const targetUserConfig = await this.userConfigRepository.findOne({
        where: { userId: actualTargetUserId },
      });

      if (targetUserConfig?.hideCollections) {
        return ListUtil.buildPaginatedList([], 0, page, limit);
      }
    }

    const queryBuilder = this.collectionRepository
      .createQueryBuilder('collection')
      .where('collection.userId = :targetUserId', {
        targetUserId: actualTargetUserId,
      });

    // 如果查询的不是自己的收藏夹，只显示公开的
    if (actualTargetUserId && actualTargetUserId !== currentUser.id) {
      queryBuilder.andWhere('collection.isPublic = :isPublic', { isPublic: true });
    }

    // 关键词搜索
    if (keyword) {
      queryBuilder.andWhere('collection.name LIKE :keyword', { keyword: `%${keyword}%` });
    }

    // 排序
    if (sortBy === 'createdAt' && (sortOrder === 'ASC' || sortOrder === 'DESC')) {
      queryBuilder.orderBy('collection.createdAt', sortOrder);
    } else {
      queryBuilder.orderBy('collection.sort', 'ASC').addOrderBy('collection.createdAt', 'DESC');
    }

    const [data, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // 对用户信息脱敏
    const sanitizedData = await Promise.all(
      data.map(async (collection) => ({
        ...collection,
        user: await this.buildSanitizedUser(collection.userId),
      })),
    );

    return ListUtil.buildPaginatedList(sanitizedData, total, page, limit);
  }

  /**
   * 获取收藏夹详情
   */
  async findOne(id: number, userId?: number) {
    const collection = await this.collectionRepository.findOne({
      where: { id },
    });

    if (!collection) {
      throw new NotFoundException('response.error.favoriteNotFound');
    }

    // 如果不是所有者，需要检查权限
    if (userId && collection.userId !== userId) {
      // 检查收藏夹是否公开
      if (!collection.isPublic) {
        throw new ForbiddenException('response.error.favoriteNotPublic');
      }

      // 检查用户是否隐藏了收藏夹
      const userConfig = await this.userConfigRepository.findOne({
        where: { userId: collection.userId },
      });

      if (userConfig?.hideCollections) {
        throw new ForbiddenException('response.error.favoritesHidden');
      }
    }

    await this.collectionRepository.increment({ id }, 'views', 1);

    const sanitizedUser = await this.buildSanitizedUser(collection.userId);

    // 对用户信息脱敏
    return {
      ...collection,
      views: collection.views + 1,
      user: sanitizedUser,
    };
  }

  /**
   * 更新收藏夹
   */
  async update(id: number, userId: number, updateCollectionDto: UpdateCollectionDto) {
    const collection = await this.collectionRepository.findOne({ where: { id } });

    if (!collection) {
      throw new NotFoundException('response.error.favoriteNotFound');
    }

    if (collection.userId !== userId) {
      throw new ForbiddenException('response.error.noPermission');
    }

    Object.assign(collection, updateCollectionDto);
    const updatedCollection = await this.collectionRepository.save(collection);

    return {
      success: true,
      message: 'response.success.favoriteUpdate',
      data: updatedCollection,
    };
  }

  /**
   * 删除收藏夹
   */
  async remove(id: number, userId: number) {
    const collection = await this.collectionRepository.findOne({ where: { id } });

    if (!collection) {
      throw new NotFoundException('response.error.favoriteNotFound');
    }

    if (collection.userId !== userId) {
      throw new ForbiddenException('response.error.noPermission');
    }

    await this.collectionRepository.remove(collection);

    return {
      success: true,
      message: 'response.success.favoriteDelete',
    };
  }

  /**
   * 添加文章到收藏夹
   */
  async addToCollection(userId: number, collectionId: number, articleId: number) {
    // 检查收藏夹是否存在且属于当前用户
    const collection = await this.collectionRepository.findOne({
      where: { id: collectionId },
    });

    if (!collection) {
      throw new NotFoundException('response.error.favoriteNotFound');
    }

    if (collection.userId !== userId) {
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
    const existingItem = await this.collectionItemRepository.findOne({
      where: { collectionId, articleId },
    });

    if (existingItem) {
      throw new BadRequestException('response.error.alreadyInFavorite');
    }

    // 获取当前收藏夹中的最大排序值
    const maxSort = await this.collectionItemRepository
      .createQueryBuilder('item')
      .select('MAX(item.sort)', 'maxSort')
      .where('item.collectionId = :collectionId', { collectionId })
      .getRawOne();

    const collectionItem = this.collectionItemRepository.create({
      collectionId,
      articleId,
      userId,
      sort: (maxSort?.maxSort || 0) + 1,
    });

    await this.collectionItemRepository.save(collectionItem);

    // 更新收藏夹的收藏数量
    collection.itemCount += 1;
    await this.collectionRepository.save(collection);

    return {
      success: true,
      message: 'response.success.addToFavorite',
      data: collectionItem,
    };
  }

  /**
   * 从收藏夹移除文章
   */
  async removeFromCollection(userId: number, collectionId: number, articleId: number) {
    const collection = await this.collectionRepository.findOne({
      where: { id: collectionId },
    });

    if (!collection) {
      throw new NotFoundException('response.error.favoriteNotFound');
    }

    if (collection.userId !== userId) {
      throw new ForbiddenException('response.error.noPermission');
    }

    const collectionItem = await this.collectionItemRepository.findOne({
      where: { collectionId, articleId },
    });

    if (!collectionItem) {
      throw new NotFoundException('response.error.favoriteItemNotFound');
    }

    await this.collectionItemRepository.remove(collectionItem);

    // 更新收藏夹的收藏数量
    collection.itemCount = Math.max(0, collection.itemCount - 1);
    await this.collectionRepository.save(collection);

    return {
      success: true,
      message: 'response.success.removeFromFavorite',
    };
  }

  /**
   * 获取收藏夹中的文章列表
   */
  async getCollectionItems(collectionId: number, currentUser: User, pagination: PaginationDto) {
    const { page, limit } = pagination;
    await this.findOne(collectionId, currentUser.id);

    const queryBuilder = this.collectionItemRepository
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.article', 'article')
      .leftJoinAndSelect('article.author', 'author')
      .leftJoinAndSelect('author.userDecorations', 'authorDecorations')
      .leftJoinAndSelect('authorDecorations.decoration', 'authorDecoration')
      .leftJoinAndSelect('article.category', 'category')
      .leftJoinAndSelect('article.tags', 'tags')
      .leftJoinAndSelect('article.downloads', 'downloads')
      .where('item.collectionId = :collectionId', { collectionId })
      .orderBy('item.sort', 'ASC')
      .addOrderBy('item.createdAt', 'DESC');

    const [items, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // 为每个项目添加上一篇和下一篇信息，并对作者信息脱敏
    const itemsWithNavigation = await Promise.all(
      items.map(async (item) => {
        const processedArticle = item.article
          ? await this.articlePresentationService.prepareArticle(item.article, currentUser)
          : null;

        // 获取上一篇
        const prevItem = await this.collectionItemRepository
          .createQueryBuilder('item')
          .leftJoinAndSelect('item.article', 'article')
          .where('item.collectionId = :collectionId', { collectionId })
          .andWhere('item.sort < :sort', { sort: item.sort })
          .orderBy('item.sort', 'DESC')
          .getOne();

        // 获取下一篇
        const nextItem = await this.collectionItemRepository
          .createQueryBuilder('item')
          .leftJoinAndSelect('item.article', 'article')
          .where('item.collectionId = :collectionId', { collectionId })
          .andWhere('item.sort > :sort', { sort: item.sort })
          .orderBy('item.sort', 'ASC')
          .getOne();

        return {
          ...item,
          article: processedArticle,
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
  async checkArticleInCollections(userId: number, articleId: number) {
    const items = await this.collectionItemRepository.find({
      where: { userId, articleId },
      relations: ['collection'],
    });

    return {
      inCollections: items.length > 0,
      collections: items.map((item) => ({
        id: item.collection.id,
        name: item.collection.name,
      })),
    };
  }

  /**
   * 获取文章所在的收藏夹信息（用于文章详情页）
   */
  async getArticleCollectionInfo(userId: number, articleId: number) {
    if (!userId) {
      return null;
    }

    const items = await this.collectionItemRepository.find({
      where: { userId, articleId },
      relations: ['collection'],
      order: { createdAt: 'DESC' },
    });

    if (items.length === 0) {
      return null;
    }

    return items.map((item) => ({
      collectionId: item.collection.id,
      collectionName: item.collection.name,
      note: item.note,
      addedAt: item.createdAt,
    }));
  }
}
