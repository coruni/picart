import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { CreateCollectionDto } from "./dto/create-collection.dto";
import { UpdateCollectionDto } from "./dto/update-collection.dto";
import { QueryCollectionDto } from "./dto/query-collection.dto";
import { Collection } from "./entities/collection.entity";
import { CollectionItem } from "./entities/collection-item.entity";
import { User } from "../user/entities/user.entity";
import { UserConfig } from "../user/entities/user-config.entity";
import { Article } from "../article/entities/article.entity";
import { ConfigService } from "../config/config.service";
import { PointsService } from "../points/points.service";
import {
  ListUtil,
  PermissionUtil,
  sanitizeUser,
  processUserDecorations,
} from "../../common/utils";
import { PaginationDto } from "src/common/dto/pagination.dto";
import { ArticlePresentationService } from "../article/article-presentation.service";

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
  ) {}

  private canManageCollections(currentUser?: User) {
    if (!currentUser) {
      return false;
    }

    return (
      PermissionUtil.hasPermission(currentUser, "collection:manage") ||
      PermissionUtil.hasPermission(currentUser, "user:manage")
    );
  }

  private canBypassUserVisibility(targetUserId: number, currentUser?: User) {
    if (!currentUser) {
      return false;
    }

    return (
      currentUser.id === targetUserId || this.canManageCollections(currentUser)
    );
  }

  private async buildSanitizedUser(userId: number) {
    const usersMap = await this.buildSanitizedUsersMap([userId]);
    return usersMap.get(userId) || null;
  }

  private async buildSanitizedUsersMap(userIds: number[]) {
    const uniqueUserIds = Array.from(new Set(userIds));
    if (uniqueUserIds.length === 0) {
      return new Map<number, ReturnType<typeof sanitizeUser>>();
    }

    const users = await this.userRepository.find({
      where: { id: In(uniqueUserIds) },
      relations: ["userDecorations", "userDecorations.decoration"],
    });

    return new Map(
      users.map((user) => [
        user.id,
        sanitizeUser(processUserDecorations(user)),
      ]),
    );
  }

  async create(userId: number, createCollectionDto: CreateCollectionDto) {
    const userCollectionCount = await this.collectionRepository.count({
      where: { userId },
    });

    const maxFreeFavorites = await this.configService.getCachedConfig(
      "favorite_max_free_count",
      6,
    );

    if (userCollectionCount >= maxFreeFavorites) {
      const createCost = await this.configService.getCachedConfig(
        "favorite_create_cost",
        10,
      );

      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException("response.error.userNotExist");
      }

      if (user.points < createCost) {
        throw new BadRequestException("response.error.insufficientPoints");
      }

      await this.pointsService.spendPoints(userId, {
        amount: createCost,
        source: "CREATE_FAVORITE",
        description: `创建收藏夹：${createCollectionDto.name}`,
        relatedType: "FAVORITE",
      });
    }

    const collection = this.collectionRepository.create({
      ...createCollectionDto,
      userId,
    });

    const savedCollection = await this.collectionRepository.save(collection);

    return {
      success: true,
      message: "response.success.favoriteCreate",
      data: savedCollection,
    };
  }

  async findAll(currentUser: User, queryDto: QueryCollectionDto) {
    const {
      page = 1,
      limit = 10,
      userId: targetUserId,
      keyword,
      sortBy,
      sortOrder,
    } = queryDto;

    const actualTargetUserId = targetUserId || currentUser.id;
    const canBypassVisibility = this.canBypassUserVisibility(
      actualTargetUserId,
      currentUser,
    );

    if (actualTargetUserId) {
      const targetUserConfig = await this.userConfigRepository.findOne({
        where: { userId: actualTargetUserId },
      });

      if (targetUserConfig?.hideCollections && !canBypassVisibility) {
        return ListUtil.buildPaginatedList([], 0, page, limit);
      }
    }

    const queryBuilder = this.collectionRepository
      .createQueryBuilder("collection")
      .where("collection.userId = :targetUserId", {
        targetUserId: actualTargetUserId,
      });

    if (actualTargetUserId && !canBypassVisibility) {
      queryBuilder.andWhere("collection.isPublic = :isPublic", {
        isPublic: true,
      });
    }

    if (keyword) {
      queryBuilder.andWhere("collection.name LIKE :keyword", {
        keyword: `%${keyword}%`,
      });
    }

    if (
      sortBy === "createdAt" &&
      (sortOrder === "ASC" || sortOrder === "DESC")
    ) {
      queryBuilder.orderBy("collection.createdAt", sortOrder);
    } else {
      queryBuilder
        .orderBy("collection.sort", "ASC")
        .addOrderBy("collection.createdAt", "DESC");
    }

    const [data, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const usersMap = await this.buildSanitizedUsersMap(
      data.map((collection) => collection.userId),
    );
    const sanitizedData = data.map((collection) => ({
      ...collection,
      user: usersMap.get(collection.userId) || null,
    }));

    return ListUtil.buildPaginatedList(sanitizedData, total, page, limit);
  }

  async findOne(id: number, currentUser?: User) {
    const collection = await this.collectionRepository.findOne({
      where: { id },
    });

    if (!collection) {
      throw new NotFoundException("response.error.favoriteNotFound");
    }

    const canBypassVisibility = this.canBypassUserVisibility(
      collection.userId,
      currentUser,
    );

    if (currentUser && !canBypassVisibility) {
      if (!collection.isPublic) {
        throw new ForbiddenException("response.error.favoriteNotPublic");
      }

      const userConfig = await this.userConfigRepository.findOne({
        where: { userId: collection.userId },
      });

      if (userConfig?.hideCollections) {
        throw new ForbiddenException("response.error.favoritesHidden");
      }
    }

    await this.collectionRepository.increment({ id }, "views", 1);

    const sanitizedUser = await this.buildSanitizedUser(collection.userId);

    return {
      ...collection,
      views: collection.views + 1,
      user: sanitizedUser,
    };
  }

  async update(
    id: number,
    userId: number,
    updateCollectionDto: UpdateCollectionDto,
  ) {
    const collection = await this.collectionRepository.findOne({
      where: { id },
    });

    if (!collection) {
      throw new NotFoundException("response.error.favoriteNotFound");
    }

    if (collection.userId !== userId) {
      throw new ForbiddenException("response.error.noPermission");
    }

    Object.assign(collection, updateCollectionDto);
    const updatedCollection = await this.collectionRepository.save(collection);

    return {
      success: true,
      message: "response.success.favoriteUpdate",
      data: updatedCollection,
    };
  }

  async remove(id: number, userId: number) {
    const collection = await this.collectionRepository.findOne({
      where: { id },
    });

    if (!collection) {
      throw new NotFoundException("response.error.favoriteNotFound");
    }

    if (collection.userId !== userId) {
      throw new ForbiddenException("response.error.noPermission");
    }

    await this.collectionRepository.remove(collection);

    return {
      success: true,
      message: "response.success.favoriteDelete",
    };
  }

  async addToCollection(
    userId: number,
    collectionId: number,
    articleId: number,
  ) {
    const collection = await this.collectionRepository.findOne({
      where: { id: collectionId },
    });

    if (!collection) {
      throw new NotFoundException("response.error.favoriteNotFound");
    }

    if (collection.userId !== userId) {
      throw new ForbiddenException("response.error.noPermission");
    }

    const article = await this.articleRepository.findOne({
      where: { id: articleId },
      relations: ["author"],
    });

    if (!article) {
      throw new NotFoundException("response.error.articleNotExist");
    }

    const existingItem = await this.collectionItemRepository.findOne({
      where: { collectionId, articleId },
    });

    if (existingItem) {
      throw new BadRequestException("response.error.alreadyInFavorite");
    }

    const maxSort = await this.collectionItemRepository
      .createQueryBuilder("item")
      .select("MAX(item.sort)", "maxSort")
      .where("item.collectionId = :collectionId", { collectionId })
      .getRawOne();

    const collectionItem = this.collectionItemRepository.create({
      collectionId,
      articleId,
      userId,
      sort: (maxSort?.maxSort || 0) + 1,
    });

    await this.collectionItemRepository.save(collectionItem);

    collection.itemCount += 1;
    await this.collectionRepository.save(collection);

    return {
      success: true,
      message: "response.success.addToFavorite",
      data: collectionItem,
    };
  }

  async removeFromCollection(
    userId: number,
    collectionId: number,
    articleId: number,
  ) {
    const collection = await this.collectionRepository.findOne({
      where: { id: collectionId },
    });

    if (!collection) {
      throw new NotFoundException("response.error.favoriteNotFound");
    }

    if (collection.userId !== userId) {
      throw new ForbiddenException("response.error.noPermission");
    }

    const collectionItem = await this.collectionItemRepository.findOne({
      where: { collectionId, articleId },
    });

    if (!collectionItem) {
      throw new NotFoundException("response.error.favoriteItemNotFound");
    }

    await this.collectionItemRepository.remove(collectionItem);

    collection.itemCount = Math.max(0, collection.itemCount - 1);
    await this.collectionRepository.save(collection);

    return {
      success: true,
      message: "response.success.removeFromFavorite",
    };
  }

  async getCollectionItems(
    collectionId: number,
    currentUser: User,
    pagination: PaginationDto,
  ) {
    const { page, limit } = pagination;
    await this.findOne(collectionId, currentUser);

    const [items, total] = await this.collectionItemRepository
      .createQueryBuilder("item")
      .leftJoinAndSelect("item.article", "article")
      .leftJoinAndSelect("article.author", "author")
      .leftJoinAndSelect("author.userDecorations", "authorDecorations")
      .leftJoinAndSelect("authorDecorations.decoration", "authorDecoration")
      .leftJoinAndSelect("article.category", "category")
      .leftJoinAndSelect("article.tags", "tags")
      .leftJoinAndSelect("article.downloads", "downloads")
      .where("item.collectionId = :collectionId", { collectionId })
      .orderBy("item.sort", "ASC")
      .addOrderBy("item.createdAt", "DESC")
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const itemsWithArticle = items.filter((item) => item.article);
    const processedArticles =
      await this.articlePresentationService.prepareArticleList(
        itemsWithArticle.map((item) => item.article),
        itemsWithArticle.length,
        1,
        itemsWithArticle.length || 1,
        currentUser,
      );
    const processedArticleMap = new Map(
      processedArticles.data.map((article) => [article.id, article]),
    );

    const itemsWithNavigation = items.map((item, index) => {
      const prevItem = index > 0 ? items[index - 1] : null;
      const nextItem = index < items.length - 1 ? items[index + 1] : null;

      return {
        ...item,
        article: item.article
          ? processedArticleMap.get(item.article.id) || null
          : null,
        prev: prevItem?.article
          ? {
              id: prevItem.article.id,
              title: prevItem.article.title,
              cover: prevItem.article.cover,
            }
          : null,
        next: nextItem?.article
          ? {
              id: nextItem.article.id,
              title: nextItem.article.title,
              cover: nextItem.article.cover,
            }
          : null,
      };
    });

    return ListUtil.buildPaginatedList(itemsWithNavigation, total, page, limit);
  }

  async checkArticleInCollections(userId: number, articleId: number) {
    const items = await this.collectionItemRepository.find({
      where: { userId, articleId },
      relations: ["collection"],
    });

    return {
      inCollections: items.length > 0,
      collections: items.map((item) => ({
        id: item.collection.id,
        name: item.collection.name,
      })),
    };
  }

  async getArticleCollectionInfo(userId: number, articleId: number) {
    if (!userId) {
      return null;
    }

    const items = await this.collectionItemRepository.find({
      where: { userId, articleId },
      relations: ["collection"],
      order: { createdAt: "DESC" },
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
