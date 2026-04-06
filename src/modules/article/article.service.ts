import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
} from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { InjectRepository } from "@nestjs/typeorm";
import {
  Like,
  Repository,
  In,
  Brackets,
  Not,
  MoreThanOrEqual,
  FindManyOptions,
  FindOptionsWhere,
} from "typeorm";
import { CreateArticleDto } from "./dto/create-article.dto";
import { UpdateArticleDto } from "./dto/update-article.dto";
import { Article } from "./entities/article.entity";
import { User } from "../user/entities/user.entity";
import { UserConfig } from "../user/entities/user-config.entity";
import { Category } from "../category/entities/category.entity";
import { Tag } from "../tag/entities/tag.entity";
import { ArticleLike } from "./entities/article-like.entity";
import { ArticleFavorite } from "./entities/article-favorite.entity";
import { Download, DownloadType } from "./entities/download.entity";
import { BrowseHistory } from "./entities/browse-history.entity";
import { PaginationDto } from "src/common/dto/pagination.dto";
import {
  PermissionUtil,
  sanitizeUser,
  stripScriptTags,
  ListUtil,
  processUserDecorations,
  ImageSerializer,
} from "src/common/utils";
import { TagService } from "../tag/tag.service";
import { UserService } from "../user/user.service";
import { OrderService } from "../order/order.service";
import { ArticleLikeDto } from "./dto/article-reaction.dto";
import { RecordBrowseHistoryDto } from "./dto/record-browse-history.dto";
import { QueryBrowseHistoryDto } from "./dto/query-browse-history.dto";
import { ConfigService } from "../config/config.service";
import { EnhancedNotificationService } from "../message/enhanced-notification.service";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { CollectionItem } from "../collection/entities/collection-item.entity";
import { TelegramDownloadService } from "./telegram-download.service";
import { ArticlePresentationService } from "./article-presentation.service";
import { SearchService } from "../search/search.service";

/**
 * 文章服务 - 核心业务逻辑处理
 * 负责文章的完整生命周期管理：
 * - 文章的创建、查询、更新、删除（CRUD）
 * - 点赞、收藏、浏览历史记录
 * - 文章搜索、推荐和热搜
 * - 权限控制和内容限制（登录、关注、会员、付款）
 */
@Injectable()
export class ArticleService {
  /** Redis 缓存中热搜数据的前缀 */
  private static readonly HOT_SEARCH_PREFIX = "article:hot-search:";
  /** 热搜统计的天数（7天内的搜索） */
  private static readonly HOT_SEARCH_DAYS = 7;
  /** 热搜数据在缓存中的存活时间（8天）*/
  private static readonly HOT_SEARCH_TTL = 8 * 24 * 60 * 60 * 1000;

  constructor(
    @InjectRepository(Article)
    private articleRepository: Repository<Article>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    @InjectRepository(Tag)
    private tagRepository: Repository<Tag>,
    @InjectRepository(ArticleLike)
    private articleLikeRepository: Repository<ArticleLike>,
    @InjectRepository(ArticleFavorite)
    private articleFavoriteRepository: Repository<ArticleFavorite>,
    @InjectRepository(Download)
    private downloadRepository: Repository<Download>,
    @InjectRepository(BrowseHistory)
    private browseHistoryRepository: Repository<BrowseHistory>,
    @InjectRepository(CollectionItem)
    private collectionItemRepository: Repository<CollectionItem>,
    @InjectRepository(UserConfig)
    private userConfigRepository: Repository<UserConfig>,
    private tagService: TagService,
    private userService: UserService,
    private orderService: OrderService,
    private configService: ConfigService,
    private enhancedNotificationService: EnhancedNotificationService,
    private eventEmitter: EventEmitter2,
    private telegramDownloadService: TelegramDownloadService,
    private articlePresentationService: ArticlePresentationService,
    private searchService: SearchService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /**
   * 创建新文章
   * 业务流程：验证分类、处理图片、检查审核、关联标签、保存下载、更新计数、触发事件
   * @param createArticleDto 创建文章数据
   * @param author 文章作者
   */
  async createArticle(createArticleDto: CreateArticleDto, author: User) {
    const {
      categoryId,
      tagIds,
      tagNames,
      status,
      sort,
      downloads,
      ...articleData
    } = createArticleDto;
    if (articleData.content !== undefined) {
      articleData.content = stripScriptTags(articleData.content);
    }
    if (articleData.summary !== undefined) {
      articleData.summary = stripScriptTags(articleData.summary);
    }
    const hasPermission = PermissionUtil.hasPermission(
      author,
      "article:manage",
    );
    const category = await this.categoryRepository.findOne({
      where: { id: categoryId },
    });
    if (!category) {
      throw new NotFoundException("response.error.categoryNotFound");
    }
    if (articleData.images) {
      // 兼容单个字符串和数组，序列化为逗号分隔的存储格式
      articleData.images = ImageSerializer.serialize(articleData.images);
    }
    const article = this.articleRepository.create({
      ...articleData,
      author,
      category,
      status: status as
        | "DRAFT"
        | "PUBLISHED"
        | "ARCHIVED"
        | "DELETED"
        | "BANNED"
        | "REJECTED"
        | "PENDING",
      ...(hasPermission && { sort: sort || 0 }),
    });
    const articleApprovalRequired =
      await this.configService.getArticleApprovalRequired();
    if (articleApprovalRequired && !hasPermission) {
      article.status = "PENDING";
    } else {
      article.status =
        (createArticleDto.status as
          | "DRAFT"
          | "PUBLISHED"
          | "ARCHIVED"
          | "DELETED"
          | "BANNED"
          | "REJECTED"
          | "PENDING") || "PUBLISHED";
    }
    const tags: Tag[] = [];
    if (tagIds && tagIds.length > 0) {
      const existingTags = await this.tagRepository.find({
        where: { id: In(tagIds) },
      });
      tags.push(...existingTags);
    }
    if (tagNames && tagNames.length > 0) {
      const createdTags = await this.tagService.findOrCreateTags(tagNames);
      createdTags.forEach((tag) => {
        if (!tags.find((t) => t.id === tag.id)) {
          tags.push(tag);
        }
      });
    }

    article.tags = tags;
    const savedArticle = await this.articleRepository.save(article);
    if (downloads && downloads.length > 0) {
      const downloadEntities = downloads.map((downloadData) =>
        this.downloadRepository.create({
          ...downloadData,
          articleId: savedArticle.id,
        }),
      );
      await this.downloadRepository.save(downloadEntities);
    }
    const articleWithDownloads = await this.articleRepository.findOne({
      where: { id: savedArticle.id },
      relations: [
        "author",
        "author.userDecorations",
        "author.userDecorations.decoration",
        "category",
        "tags",
        "downloads",
      ],
    });
    if (savedArticle.status === "PUBLISHED") {
      this.userService.incrementArticleCount(author.id);
      this.categoryRepository.increment({ id: category.id }, "articleCount", 1);
      for (const tag of tags) {
        await this.tagRepository.increment({ id: tag.id }, "articleCount", 1);
      }
    }
    if (savedArticle.status === "PUBLISHED") {
      try {
        this.eventEmitter.emit("article.created", {
          userId: author.id,
          articleId: savedArticle.id,
        });
      } catch (error) {
        console.error("触发文章创建事件失败", error);
      }
    }
    return {
      success: true,
      message: "response.success.articleCreate",
      data: articleWithDownloads
        ? await this.articlePresentationService.prepareBasicArticle(
            articleWithDownloads,
          )
        : null,
    };
  }
  async findAllArticles(
    pagination: PaginationDto,
    title?: string,
    categoryId?: number,
    user?: User,
    status?:
      | "DRAFT"
      | "PUBLISHED"
      | "ARCHIVED"
      | "DELETED"
      | "BANNED"
      | "REJECTED"
      | "PENDING",
    type?: "all" | "popular" | "latest" | "following",
    tagId?: number,
  ) {
    const hasPermission =
      user && PermissionUtil.hasPermission(user, "article:manage");
    const baseConditionMappers = [
      () =>
        hasPermission
          ? status
            ? { status }
            : undefined
          : { status: "PUBLISHED" as const },
      () => !user && { listRequireLogin: false },
      () => title && { title: Like(`%${title}%`) },
      () => categoryId && { category: { id: categoryId } },
    ];
    const baseWhereCondition = baseConditionMappers
      .map((mapper) => mapper())
      .filter(Boolean)
      .reduce((acc, curr) => ({ ...acc, ...curr }), {});

    const { page, limit } = pagination;
    const commonRelations = [
      "author",
      "author.userDecorations",
      "author.userDecorations.decoration",
      "category",
      "tags",
      "downloads",
    ];
    const commonPagination = {
      skip: (page - 1) * limit,
      take: limit,
    };

    if (tagId) {
      return this.findAllArticlesByTagWithFullTags(
        pagination,
        baseWhereCondition,
        user,
        type,
        tagId,
      );
    }

    let findOptions: FindManyOptions<Article>;
    switch (type) {
      case "popular": {
        // 混合排序：热度分 + 时间衰减（类似 Hacker News 算法）
        // score = (热度分) / (时间衰减因子^1.5)
        // 热度分 = views*0.1 + likes*2 + comments*3 + favorites*4
        // 时间衰减 = (小时数 + 2)^1.5，+2让新文章有初始优势
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const qb = this.articleRepository
          .createQueryBuilder("article")
          .leftJoinAndSelect("article.author", "author")
          .leftJoinAndSelect("author.userDecorations", "authorDecorations")
          .leftJoinAndSelect("authorDecorations.decoration", "authorDecoration")
          .leftJoinAndSelect("article.category", "category")
          .leftJoinAndSelect("article.tags", "tags")
          .where(baseWhereCondition)
          .andWhere("article.createdAt >= :oneWeekAgo", { oneWeekAgo });

        // 计算热度分（数据库层面，TypeORM 默认 camelCase -> snake_case）
        qb.addSelect(`
          (
            COALESCE(article.views, 0) * 0.1 +
            COALESCE(article.likes, 0) * 2 +
            COALESCE(article.comment_count, 0) * 3 +
            COALESCE(article.favorite_count, 0) * 4
          ) / POWER(
            EXTRACT(EPOCH FROM (NOW() - article.created_at)) / 3600 + 2,
            1.5
          )
        `, "hot_score");

        qb.orderBy("hot_score", "DESC")
          .addOrderBy("article.sort", "DESC")
          .addOrderBy("article.createdAt", "DESC");

        qb.skip((page - 1) * limit).take(limit);

        const [data, total] = await qb.getManyAndCount();

        // 如果时间窗口内没有数据，回退到默认排序（不限时间）
        if (total === 0 && page === 1) {
          const fallbackQb = this.articleRepository
            .createQueryBuilder("article")
            .leftJoinAndSelect("article.author", "author")
            .leftJoinAndSelect("author.userDecorations", "authorDecorations")
            .leftJoinAndSelect("authorDecorations.decoration", "authorDecoration")
            .leftJoinAndSelect("article.category", "category")
            .leftJoinAndSelect("article.tags", "tags")
            .where(baseWhereCondition)
            .orderBy("article.sort", "DESC")
            .addOrderBy("article.createdAt", "DESC");

          fallbackQb.skip((page - 1) * limit).take(limit);
          const [fallbackData, fallbackTotal] = await fallbackQb.getManyAndCount();
          return this.processArticleResults(fallbackData, fallbackTotal, page, limit, user);
        }

        return this.processArticleResults(data, total, page, limit, user);
      }

      case "latest":
        findOptions = {
          where: baseWhereCondition,
          relations: commonRelations,
          order: {
            sort: "DESC" as const,
            createdAt: "DESC" as const,
          },
          ...commonPagination,
        };
        break;

      case "following":
        if (!user) {
          return ListUtil.buildPaginatedList([], 0, page, limit);
        }
        const followingUsers = await this.userService
          .getUserRepository()
          .createQueryBuilder("user")
          .innerJoin("user.followers", "follower", "follower.id = :userId", {
            userId: user.id,
          })
          .getMany();

        const followingUserIds = followingUsers.map((u) => u.id);
        if (followingUserIds.length === 0) {
          return ListUtil.buildPaginatedList([], 0, page, limit);
        }

        findOptions = {
          where: {
            ...baseWhereCondition,
            author: {
              id: In(followingUserIds),
            },
          },
          relations: commonRelations,
          order: {
            sort: "DESC" as const,
            createdAt: "DESC" as const,
            views: "DESC" as const,
          },
          ...commonPagination,
        };
        break;

      default:
        findOptions = {
          where: baseWhereCondition,
          relations: commonRelations,
          order: {
            sort: "DESC" as const,
            createdAt: "DESC" as const,
          },
          ...commonPagination,
        };
        break;
    }

    const [data, total] =
      await this.articleRepository.findAndCount(findOptions);

    return this.processArticleResults(data, total, page, limit, user);
  }

  private async findAllArticlesByTagWithFullTags(
    pagination: PaginationDto,
    baseWhereCondition: Record<string, any>,
    user: User | undefined,
    type: "all" | "popular" | "latest" | "following" | undefined,
    tagId: number,
  ) {
    const { page, limit } = pagination;
    const queryBuilder = this.articleRepository
      .createQueryBuilder("article")
      .distinct(true)
      .leftJoinAndSelect("article.author", "author")
      .leftJoinAndSelect("author.userDecorations", "userDecorations")
      .leftJoinAndSelect("userDecorations.decoration", "decoration")
      .leftJoinAndSelect("article.category", "category")
      .leftJoinAndSelect("article.tags", "tags")
      .leftJoinAndSelect("article.downloads", "downloads")
      .innerJoin("article.tags", "filterTag", "filterTag.id = :tagId", {
        tagId,
      });

    if (baseWhereCondition.status) {
      queryBuilder.andWhere("article.status = :status", {
        status: baseWhereCondition.status,
      });
    }

    if (baseWhereCondition.listRequireLogin !== undefined) {
      queryBuilder.andWhere("article.listRequireLogin = :listRequireLogin", {
        listRequireLogin: baseWhereCondition.listRequireLogin,
      });
    }

    if (baseWhereCondition.title) {
      queryBuilder.andWhere("article.title LIKE :title", {
        title: baseWhereCondition.title,
      });
    }

    if (baseWhereCondition.category?.id) {
      queryBuilder.andWhere("article.categoryId = :categoryId", {
        categoryId: baseWhereCondition.category.id,
      });
    }

    switch (type) {
      case "popular": {
        // 混合排序：热度分 + 时间衰减（类似 Hacker News 算法）
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        queryBuilder.andWhere("article.createdAt >= :oneWeekAgo", {
          oneWeekAgo,
        });

        // 计算热度分
        queryBuilder.addSelect(`
          (
            COALESCE(article.views, 0) * 0.1 +
            COALESCE(article.likes, 0) * 2 +
            COALESCE(article.comment_count, 0) * 3 +
            COALESCE(article.favorite_count, 0) * 4
          ) / POWER(
            EXTRACT(EPOCH FROM (NOW() - article.created_at)) / 3600 + 2,
            1.5
          )
        `, "hot_score");

        queryBuilder
          .orderBy("hot_score", "DESC")
          .addOrderBy("article.sort", "DESC")
          .addOrderBy("article.createdAt", "DESC");
        break;
      }
      case "following": {
        if (!user) {
          return ListUtil.buildPaginatedList([], 0, page, limit);
        }
        const followingUsers = await this.userService
          .getUserRepository()
          .createQueryBuilder("user")
          .innerJoin("user.followers", "follower", "follower.id = :userId", {
            userId: user.id,
          })
          .getMany();

        const followingUserIds = followingUsers.map((u) => u.id);
        if (followingUserIds.length === 0) {
          return ListUtil.buildPaginatedList([], 0, page, limit);
        }

        queryBuilder.andWhere("article.authorId IN (:...followingUserIds)", {
          followingUserIds,
        });
        queryBuilder
          .orderBy("article.sort", "DESC")
          .addOrderBy("article.createdAt", "DESC")
          .addOrderBy("article.views", "DESC");
        break;
      }
      case "latest":
      default:
        queryBuilder
          .orderBy("article.sort", "DESC")
          .addOrderBy("article.createdAt", "DESC");
        break;
    }

    const [data, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // 如果热门时间窗口内没有数据，回退到默认排序
    if (total === 0 && type === "popular" && page === 1) {
      const fallbackQb = this.articleRepository
        .createQueryBuilder("article")
        .distinct(true)
        .leftJoinAndSelect("article.author", "author")
        .leftJoinAndSelect("author.userDecorations", "authorDecorations")
        .leftJoinAndSelect("authorDecorations.decoration", "authorDecoration")
        .leftJoinAndSelect("article.category", "category")
        .leftJoinAndSelect("article.tags", "tags")
        .leftJoinAndSelect("article.downloads", "downloads")
        .innerJoin("article.tags", "filterTag", "filterTag.id = :tagId", {
          tagId,
        })
        .where(baseWhereCondition)
        .orderBy("article.sort", "DESC")
        .addOrderBy("article.createdAt", "DESC");

      if (baseWhereCondition.status) {
        fallbackQb.andWhere("article.status = :status", {
          status: baseWhereCondition.status,
        });
      }

      if (baseWhereCondition.listRequireLogin !== undefined) {
        fallbackQb.andWhere("article.listRequireLogin = :listRequireLogin", {
          listRequireLogin: baseWhereCondition.listRequireLogin,
        });
      }

      if (baseWhereCondition.title) {
        fallbackQb.andWhere("article.title LIKE :title", {
          title: baseWhereCondition.title,
        });
      }

      if (baseWhereCondition.category?.id) {
        fallbackQb.andWhere("article.categoryId = :categoryId", {
          categoryId: baseWhereCondition.category.id,
        });
      }

      const [fallbackData, fallbackTotal] = await fallbackQb
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();
      return this.processArticleResults(fallbackData, fallbackTotal, page, limit, user);
    }

    return this.processArticleResults(data, total, page, limit, user);
  }

  private async getCategoryAndDescendantIds(
    categoryId: number,
  ): Promise<number[]> {
    const categories = await this.categoryRepository.find({
      select: ["id", "parentId"],
    });

    const categoryMap = new Map<number, number[]>();

    for (const category of categories) {
      if (category.parentId === null || category.parentId === undefined) {
        continue;
      }

      const children = categoryMap.get(category.parentId) || [];
      children.push(category.id);
      categoryMap.set(category.parentId, children);
    }

    const ids = new Set<number>([categoryId]);
    const queue = [categoryId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const children = categoryMap.get(currentId) || [];

      for (const childId of children) {
        if (ids.has(childId)) {
          continue;
        }

        ids.add(childId);
        queue.push(childId);
      }
    }

    return [...ids];
  }

  private normalizeSearchKeyword(keyword?: string): string {
    if (!keyword) {
      return "";
    }

    return keyword
      .normalize("NFKC")
      .trim()
      .replace(/\s+/g, " ")
      .toLocaleLowerCase("zh-CN")
      .slice(0, 100);
  }

  private applySearchSort(
    queryBuilder: ReturnType<Repository<Article>["createQueryBuilder"]>,
    sortBy: "relevance" | "latest" | "views" | "likes",
  ) {
    switch (sortBy) {
      case "latest":
        queryBuilder
          .orderBy("article.sort", "DESC")
          .addOrderBy("article.createdAt", "DESC");
        break;
      case "views":
        queryBuilder
          .orderBy("article.sort", "DESC")
          .addOrderBy("article.views", "DESC")
          .addOrderBy("article.createdAt", "DESC");
        break;
      case "likes":
        queryBuilder
          .orderBy("article.sort", "DESC")
          .addOrderBy("article.likes", "DESC")
          .addOrderBy("article.createdAt", "DESC");
        break;
      default:
        queryBuilder
          .orderBy("relevanceScore", "DESC")
          .addOrderBy("article.sort", "DESC")
          .addOrderBy("article.views", "DESC")
          .addOrderBy("article.createdAt", "DESC");
        break;
    }
  }

  private getHotSearchCacheKey(date: Date): string {
    const dateString = date.toISOString().slice(0, 10);
    return `${ArticleService.HOT_SEARCH_PREFIX}${dateString}`;
  }

  private async recordHotSearch(keyword: string): Promise<void> {
    const cacheKey = this.getHotSearchCacheKey(new Date());
    const currentData =
      (await this.cacheManager.get<Record<string, number>>(cacheKey)) || {};

    currentData[keyword] = (currentData[keyword] || 0) + 1;
    await this.cacheManager.set(
      cacheKey,
      currentData,
      ArticleService.HOT_SEARCH_TTL,
    );
  }

  /**
   * 批量处理文章列表
   * 负责数据转换和enrichment：
   * - 填充分类和标签数据
   * - 处理图片格式和提取摘要
   * - 获取用户的点赞/收藏状态
   * - 获取点赞反应统计
   * - 充实作者信息（是否会员、是否被关注）
   * @param data 文章列表
   * @param total 总条数
   * @param page 当前页
   * @param limit 每页条数
   * @param user 当前用户（可选，用于获取个人状态）
   */
  private async processArticleResults(
    data: Article[],
    total: number,
    page: number,
    limit: number,
    user?: User,
  ) {
    return this.articlePresentationService.prepareArticleList(
      data,
      total,
      page,
      limit,
      user,
    );
  }

  /**
   * 获取单个文章详情
   * 业务流程：权限检查、增加浏览次数、记录浏览历史、获取用户点赞/收藏状态、
   * 处理文章权限（根据登录/关注/会员/付款要求返回完整或预览内容）、获取收藏夹导航信息
   * @param id 文章ID
   * @param currentUser 当前用户（用于权限检查和状态获取）
   */
  async findOne(id: number, currentUser?: User) {
    const hasPermission = PermissionUtil.hasPermission(
      currentUser,
      "article:manage",
    );
    const whereCondition: FindOptionsWhere<Article> = {
      ...(!hasPermission && { status: "PUBLISHED" }),
      id: id,
    };

    const article = await this.articleRepository.findOne({
      where: whereCondition,
      relations: [
        "author",
        "author.userDecorations",
        "author.userDecorations.decoration",
        "category",
        "tags",
        "downloads",
      ],
    });

    if (!article) {
      throw new NotFoundException("response.error.articleNotFound");
    }
    await this.incrementViews(id);
    if (currentUser) {
      try {
        await this.recordBrowseHistory(currentUser.id, id);
      } catch (error) {
        console.error("更新浏览记录失败", error);
      }
    }
    const processedArticle =
      await this.articlePresentationService.prepareArticle(
        article,
        currentUser,
      );
    if (processedArticle.author) {
      const authorCollectionItem = await this.collectionItemRepository.findOne({
        where: {
          articleId: processedArticle.id,
          userId: processedArticle.author.id,
        },
        relations: [
          "collection",
          "collection.items",
          "collection.items.article",
        ],
        order: { createdAt: "DESC" },
      });

      if (authorCollectionItem && authorCollectionItem.collection) {
        const { user, userId, items, ...collectionData } =
          authorCollectionItem.collection;
        const publishedItems = items
          .filter((item) => item.article && item.article.status === "PUBLISHED")
          .sort((a, b) => {
            if (a.sort !== b.sort) {
              return a.sort - b.sort;
            }
            return (
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
          });

        const currentIndex = publishedItems.findIndex(
          (item) => item.id === authorCollectionItem.id,
        );
        const prevItem =
          currentIndex > 0 ? publishedItems[currentIndex - 1] : null;
        const nextItem =
          currentIndex < publishedItems.length - 1
            ? publishedItems[currentIndex + 1]
            : null;
        (processedArticle as any).collection = {
          ...collectionData,
          current: {
            itemId: authorCollectionItem.id,
            articleId: authorCollectionItem.articleId,
            index: currentIndex >= 0 ? currentIndex + 1 : null,
            sort: authorCollectionItem.sort,
          },
          navigation: {
            prev:
              prevItem && prevItem.article
                ? {
                    itemId: prevItem.id,
                    articleId: prevItem.article.id,
                    title: prevItem.article.title,
                    cover: prevItem.article.cover,
                    index: currentIndex,
                  }
                : null,
            next:
              nextItem && nextItem.article
                ? {
                    itemId: nextItem.id,
                    articleId: nextItem.article.id,
                    title: nextItem.article.title,
                    cover: nextItem.article.cover,
                    index: currentIndex + 2,
                  }
                : null,
          },
        };
      }
    }

    return processedArticle;
  }

  /**
   * 规范化文章图片格式
   * 将图片从逗号分隔字符串转换为数组，或使用空数组作为默认值
   * 对于混合类型文章，若没有手动图片则从 HTML 内容中提取
   * @param article 要处理的文章
   */
  private processArticleImages(article: Article) {
    // 使用 ImageSerializer 处理图片，兼容旧数据格式
    article.images = ImageSerializer.processImages(
      article.images as any,
    ) as any;

    if (
      article.type === "mixed" &&
      Array.isArray(article.images) &&
      article.images.length === 0 &&
      article.content
    ) {
      article.images = this.extractQlImageUrlsFromHtml(article.content) as any;
    }
  }

  private fillArticleSummaryFromContent(article: Article) {
    if (article.summary && article.summary.trim() !== "") {
      return;
    }

    const summary = this.extractSummaryFromHtml(article.content, 180);
    if (summary) {
      article.summary = summary;
    }
  }

  /**
   * 从 HTML 内容中提取摘要
   * 处理流程：
   * 1. 移除脚本和样式标签
   * 2. 转换 HTML 实体和换行符为纯文本
   * 3. 保留表情符号占位符以还原原始标签
   * 4. 裁剪至指定长度并添加省略号
   * @param html HTML 内容
   * @param maxLength 最大长度（默认180）
   */
  private extractSummaryFromHtml(
    html?: string,
    maxLength: number = 180,
  ): string {
    if (!html || typeof html !== "string") {
      return "";
    }

    const cleanedHtml = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .trim();

    if (!cleanedHtml) {
      return "";
    }

    const emojiImgs: string[] = [];
    const withEmojiPlaceholders = cleanedHtml.replace(
      /<img\b[^>]*>/gi,
      (tag) => {
        const classMatch = tag.match(/\bclass\s*=\s*["']([^"']*)["']/i);
        const classNames = classMatch?.[1] || "";
        if (!/\bql-emoji-embed__img\b/.test(classNames)) {
          return " ";
        }

        const index = emojiImgs.push(tag) - 1;
        return ` __EMOJI_${index}__ `;
      },
    );

    const plainText = withEmojiPlaceholders
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|h1|h2|h3|h4|h5|h6|li|blockquote)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/\s+/g, " ")
      .trim();

    if (!plainText) {
      return "";
    }

    const cropped =
      plainText.length > maxLength
        ? `${plainText.slice(0, maxLength).trim()}...`
        : plainText;

    return cropped.replace(/__EMOJI_(\d+)__/g, (_, indexText: string) => {
      const index = Number(indexText);
      return emojiImgs[index] || "";
    });
  }

  private extractQlImageUrlsFromHtml(html?: string): string[] {
    if (!html || typeof html !== "string") {
      return [];
    }

    const imageTagRegex = /<img\b[^>]*>/gi;
    const srcSet = new Set<string>();
    const tags = html.match(imageTagRegex) || [];

    for (const tag of tags) {
      const classMatch = tag.match(/\bclass\s*=\s*["']([^"']*)["']/i);
      const classNames = classMatch?.[1] || "";

      if (!/\bql-image\b/.test(classNames)) {
        continue;
      }

      const srcMatch = tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
      const src = srcMatch?.[1]?.trim();
      if (src) {
        srcSet.add(src);
      }
    }

    return Array.from(srcSet);
  }

  /**
   * 更新文章
   * 权限检查：仅作者或管理员可编辑
   * 业务流程：验证权限、更新分类（需要调整计数）、更新标签、处理状态转换、更新下载资源
   * @param id 文章ID
   * @param updateArticleDto 更新数据
   * @param currentUser 当前用户
   */
  async update(
    id: number,
    updateArticleDto: UpdateArticleDto,
    currentUser: User,
  ) {
    const { categoryId, tagIds, tagNames, downloads, ...articleData } =
      updateArticleDto;
    if (articleData.content !== undefined) {
      articleData.content = stripScriptTags(articleData.content);
      // 如果内容更新且没有手动提供摘要，自动重新生成摘要
      if (!updateArticleDto.summary) {
        articleData.summary = this.extractSummaryFromHtml(
          articleData.content,
          180,
        );
      }
    }
    if (articleData.summary !== undefined) {
      articleData.summary = stripScriptTags(articleData.summary);
    }
    const article = await this.articleRepository.findOne({
      where: { id },
      relations: ["category", "tags", "downloads"],
    });
    if (!article) {
      throw new NotFoundException("response.error.articleNotFound");
    }
    if (
      currentUser.id !== article.authorId &&
      !PermissionUtil.hasPermission(currentUser, "article:manage")
    ) {
      throw new ForbiddenException("response.error.noPermission");
    }
    if (articleData.images) {
      // 兼容单个字符串和数组，序列化为逗号分隔的存储格式
      articleData.images = ImageSerializer.serialize(articleData.images);
    }
    if (categoryId) {
      const oldCategoryId = article.category?.id;

      const category = await this.categoryRepository.findOne({
        where: { id: categoryId },
      });
      if (!category) {
        throw new Error("response.error.categoryNotFound");
      }
      article.category = category;
      if (
        article.status === "PUBLISHED" &&
        oldCategoryId &&
        oldCategoryId !== categoryId
      ) {
        await this.categoryRepository.decrement(
          { id: oldCategoryId },
          "articleCount",
          1,
        );
        await this.categoryRepository.increment(
          { id: categoryId },
          "articleCount",
          1,
        );
      }
    }
    if (tagIds || tagNames) {
      const oldTagIds = article.tags?.map((t) => t.id) || [];

      const tags: Tag[] = [];
      if (tagIds && tagIds.length > 0) {
        const existingTags = await this.tagRepository.find({
          where: { id: In(tagIds) },
        });
        tags.push(...existingTags);
      }
      if (tagNames && tagNames.length > 0) {
        const createdTags = await this.tagService.findOrCreateTags(tagNames);
        createdTags.forEach((tag) => {
          if (!tags.find((t) => t.id === tag.id)) {
            tags.push(tag);
          }
        });
      }

      const newTagIds = tags.map((t) => t.id);
      if (article.status === "PUBLISHED") {
        for (const oldTagId of oldTagIds) {
          if (!newTagIds.includes(oldTagId)) {
            await this.tagRepository.decrement(
              { id: oldTagId },
              "articleCount",
              1,
            );
          }
        }
        for (const newTagId of newTagIds) {
          if (!oldTagIds.includes(newTagId)) {
            await this.tagRepository.increment(
              { id: newTagId },
              "articleCount",
              1,
            );
          }
        }
      }

      article.tags = tags;
    }
    const oldStatus = article.status;
    Object.assign(article, articleData);
    const newStatus = articleData.status;

    if (newStatus && oldStatus !== newStatus) {
      if (oldStatus !== "PUBLISHED" && newStatus === "PUBLISHED") {
        if (article.category) {
          await this.categoryRepository.increment(
            { id: article.category.id },
            "articleCount",
            1,
          );
        }
        if (article.tags && article.tags.length > 0) {
          for (const tag of article.tags) {
            await this.tagRepository.increment(
              { id: tag.id },
              "articleCount",
              1,
            );
          }
        }
        this.userService.incrementArticleCount(article.authorId);
      } else if (oldStatus === "PUBLISHED" && newStatus !== "PUBLISHED") {
        if (article.category) {
          await this.categoryRepository.decrement(
            { id: article.category.id },
            "articleCount",
            1,
          );
        }
        if (article.tags && article.tags.length > 0) {
          for (const tag of article.tags) {
            await this.tagRepository.decrement(
              { id: tag.id },
              "articleCount",
              1,
            );
          }
        }
        this.userService.decrementArticleCount(article.authorId);
      }
    }

    const updatedArticle = await this.articleRepository.save(article);
    if (downloads !== undefined) {
      await this.downloadRepository.delete({ articleId: id });
      if (downloads && downloads.length > 0) {
        const downloadEntities = downloads.map((downloadData) =>
          this.downloadRepository.create({
            ...downloadData,
            articleId: id,
          }),
        );
        await this.downloadRepository.save(downloadEntities);
      }
    }
    const articleWithDownloads = await this.articleRepository.findOne({
      where: { id },
      relations: [
        "author",
        "author.userDecorations",
        "author.userDecorations.decoration",
        "category",
        "tags",
        "downloads",
      ],
    });

    // 触发文章更新事件
    try {
      this.eventEmitter.emit("article.updated", {
        articleId: id,
      });
    } catch (error) {
      console.error("触发文章更新事件失败", error);
    }

    return {
      success: true,
      message: "response.success.articleUpdate",
      data: articleWithDownloads
        ? await this.articlePresentationService.prepareBasicArticle(
            articleWithDownloads,
          )
        : null,
    };
  }

  /**
   * 删除文章
   * 权限检查：仅作者或管理员可删除
   * 业务流程：权限验证、删除关联数据、更新分类/标签的计数器（如果文章已发布）、更新用户文章计数
   * @param id 文章ID
   * @param user 当前用户
   */
  async remove(id: number, user: User) {
    const article = await this.articleRepository.findOne({
      where: { id },
      relations: ["category", "tags"],
    });
    if (!article) {
      throw new NotFoundException("response.error.articleNotFound");
    }
    if (
      article.authorId !== user.id &&
      !PermissionUtil.hasPermission(user, "article:manage")
    ) {
      throw new ForbiddenException("response.error.noPermission");
    }
    const categoryId = article.category?.id;
    const tagIds = article.tags?.map((tag) => tag.id) || [];
    const wasPublished = article.status === "PUBLISHED";
    await this.articleRepository.remove(article);
    if (wasPublished) {
      if (categoryId) {
        await this.categoryRepository.decrement(
          { id: categoryId },
          "articleCount",
          1,
        );
      }
      for (const tagId of tagIds) {
        await this.tagRepository.decrement({ id: tagId }, "articleCount", 1);
      }
      this.userService.decrementArticleCount(article.authorId);
    }

    // 触发文章删除事件
    try {
      this.eventEmitter.emit("article.deleted", {
        articleId: id,
      });
    } catch (error) {
      console.error("触发文章删除事件失败", error);
    }

    return {
      success: true,
      message: "response.success.articleDelete",
    };
  }

  /**
   * 对文章添加/移除点赞或其他反应
   * 支持的反应类型：like、love、haha、wow、sad、angry、dislike
   * 业务流程：验证文章存在、检查用户是否已点过、更新或删除点赞记录、更新点赞计数、触发事件
   * @param articleId 文章ID
   * @param user 当前用户
   * @param likeDto 反应信息（包含反应类型）
   */
  async like(articleId: number, user: User, likeDto?: ArticleLikeDto) {
    const article = await this.articleRepository.findOne({
      where: { id: articleId },
      relations: ["author"],
    });
    if (!article) {
      throw new NotFoundException("response.error.articleNotFound");
    }
    const reactionType = likeDto?.reactionType || "like";
    const existingLike = await this.articleLikeRepository.findOne({
      where: {
        articleId,
        userId: user.id,
      },
    });

    if (existingLike) {
      if (existingLike.reactionType === reactionType) {
        await this.articleLikeRepository.remove(existingLike);
        if (reactionType === "like") {
          await this.articleRepository.decrement({ id: articleId }, "likes", 1);
          if (article.author?.id && article.author.id !== user.id) {
            await this.userService.decrementReceivedLikes(article.author.id);
          }
        }

        return {
          success: true,
          message: "response.success.reactionRemoved",
        };
      } else {
        const oldReactionType = existingLike.reactionType;
        existingLike.reactionType = reactionType;
        await this.articleLikeRepository.save(existingLike);
        if (oldReactionType !== "like" && reactionType === "like") {
          await this.articleRepository.increment({ id: articleId }, "likes", 1);
          if (article.author?.id && article.author.id !== user.id) {
            await this.userService.incrementReceivedLikes(article.author.id);
          }
        } else if (oldReactionType === "like" && reactionType !== "like") {
          await this.articleRepository.decrement({ id: articleId }, "likes", 1);
          if (article.author?.id && article.author.id !== user.id) {
            await this.userService.decrementReceivedLikes(article.author.id);
          }
        }

        return {
          success: true,
          message: "response.success.reactionUpdated",
        };
      }
    } else {
      const like = this.articleLikeRepository.create({
        articleId,
        userId: user.id,
        reactionType,
      });
      await this.articleLikeRepository.save(like);
      if (reactionType === "like") {
        await this.articleRepository.increment({ id: articleId }, "likes", 1);
        if (article.author?.id && article.author.id !== user.id) {
          await this.userService.incrementReceivedLikes(article.author.id);
        }
      }
      if (reactionType === "like") {
        try {
          this.eventEmitter.emit("article.liked", {
            userId: user.id,
            articleId,
            userName: user.nickname || user.username,
            articleTitle: article.title,
            authorId: article.author?.id,
          });
          if (article.author?.id && article.author.id !== user.id) {
            this.eventEmitter.emit("article.receivedLike", {
              authorId: article.author.id,
              articleId,
              likerId: user.id,
            });
          }
        } catch (error) {
          console.error("触发文章点赞事件失败", error);
        }
      }

      return {
        success: true,
        message: "response.success.reactionAdded",
      };
    }
  }
  async getLikeStatus(
    articleId: number,
    userId: number,
  ): Promise<{ liked: boolean; reactionType?: string }> {
    const like = await this.articleLikeRepository.findOne({
      where: {
        articleId,
        userId,
      },
    });

    return {
      liked: !!like,
      reactionType: like?.reactionType,
    };
  }
  async getLikeCount(articleId: number): Promise<number> {
    const count = await this.articleLikeRepository.count({
      where: {
        articleId,
        reactionType: "like",
      },
    });
    return count;
  }
  async getDislikeCount(articleId: number): Promise<number> {
    const count = await this.articleLikeRepository.count({
      where: {
        articleId,
        reactionType: "dislike",
      },
    });
    return count;
  }
  async getReactionStats(
    articleId: number,
  ): Promise<{ [key: string]: number }> {
    const result = await this.articleLikeRepository
      .createQueryBuilder("articleLike")
      .select("articleLike.reactionType", "reactionType")
      .addSelect("COUNT(*)", "count")
      .where("articleLike.articleId = :articleId", { articleId })
      .groupBy("articleLike.reactionType")
      .getRawMany();
    const stats = {
      like: 0,
      love: 0,
      haha: 0,
      wow: 0,
      sad: 0,
      angry: 0,
      dislike: 0,
    };
    result.forEach((row) => {
      stats[row.reactionType] = parseInt(row.count, 10);
    });

    return stats;
  }
  async getUserReaction(
    articleId: number,
    userId: number,
  ): Promise<any | null> {
    return await this.articleLikeRepository.findOne({
      where: {
        articleId,
        userId,
      },
    });
  }
  async getReactions(articleId: number, limit: number = 50): Promise<any[]> {
    return await this.articleLikeRepository.find({
      where: { articleId },
      relations: ["user"],
      order: { createdAt: "DESC" },
      take: limit,
    });
  }
  async findByCategory(
    categoryId: number,
    pagination: PaginationDto,
    user?: User,
  ) {
    const { page, limit } = pagination;

    const findOptions = {
      where: {
        category: { id: categoryId },
        status: "PUBLISHED" as const,
      },
      relations: ["author", "category", "tags", "downloads"],
      order: {
        sort: "DESC" as const,
        createdAt: "DESC" as const,
      },
      skip: (page - 1) * limit,
      take: limit,
    };

    const [data, total] =
      await this.articleRepository.findAndCount(findOptions);

    return this.processArticleResults(data, total, page, limit, user);
  }
  async findByTag(tagId: number, pagination: PaginationDto, user?: User) {
    const { page, limit } = pagination;
    const queryBuilder = this.articleRepository
      .createQueryBuilder("article")
      .distinct(true)
      .leftJoinAndSelect("article.author", "author")
      .leftJoinAndSelect("article.category", "category")
      .leftJoinAndSelect("article.tags", "tags")
      .leftJoinAndSelect("article.downloads", "downloads")
      .innerJoin("article.tags", "filterTag", "filterTag.id = :tagId", {
        tagId,
      })
      .where("article.status = :status", { status: "PUBLISHED" })
      .orderBy("article.sort", "DESC")
      .addOrderBy("article.createdAt", "DESC");

    const [data, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return this.processArticleResults(data, total, page, limit, user);
  }
  async findByAuthor(
    authorId: number,
    pagination: PaginationDto,
    user?: User,
    type?: "all" | "popular" | "latest",
    categoryId?: number,
    keyword?: string,
  ) {
    const hasPermission =
      (user && PermissionUtil.hasPermission(user, "article:manage")) ||
      user?.id === authorId;
    const baseConditionMappers = [
      () => !hasPermission && { status: "PUBLISHED" },
      () => categoryId && { category: { id: categoryId } },
      () =>
        keyword && {
          title: Like(`%${keyword}%`),
          content: Like(`%${keyword}%`),
          tags: {
            name: Like(`%${keyword}%`),
          },
        },
      () => ({ author: { id: authorId } }),
    ];
    const baseWhereCondition = baseConditionMappers
      .map((mapper) => mapper())
      .filter(Boolean)
      .reduce((acc, curr) => ({ ...acc, ...curr }), {});

    const { page, limit } = pagination;
    const commonRelations = [
      "author",
      "author.userDecorations",
      "author.userDecorations.decoration",
      "category",
      "tags",
      "downloads",
    ];
    const commonPagination = {
      skip: (page - 1) * limit,
      take: limit,
    };

    let findOptions: FindManyOptions<Article>;
    switch (type) {
      case "popular": {
        // 混合排序：热度分 + 时间衰减（类似 Hacker News 算法）
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const qb = this.articleRepository
          .createQueryBuilder("article")
          .leftJoinAndSelect("article.author", "author")
          .leftJoinAndSelect("author.userDecorations", "authorDecorations")
          .leftJoinAndSelect("authorDecorations.decoration", "authorDecoration")
          .leftJoinAndSelect("article.category", "category")
          .leftJoinAndSelect("article.tags", "tags")
          .where(baseWhereCondition)
          .andWhere("article.createdAt >= :oneWeekAgo", { oneWeekAgo });

        // 计算热度分
        qb.addSelect(`
          (
            COALESCE(article.views, 0) * 0.1 +
            COALESCE(article.likes, 0) * 2 +
            COALESCE(article.comment_count, 0) * 3 +
            COALESCE(article.favorite_count, 0) * 4
          ) / POWER(
            EXTRACT(EPOCH FROM (NOW() - article.created_at)) / 3600 + 2,
            1.5
          )
        `, "hot_score");

        qb.orderBy("hot_score", "DESC")
          .addOrderBy("article.sort", "DESC")
          .addOrderBy("article.createdAt", "DESC");

        qb.skip((page - 1) * limit).take(limit);

        const [data, total] = await qb.getManyAndCount();

        // 如果时间窗口内没有数据，回退到默认排序
        if (total === 0 && page === 1) {
          const fallbackQb = this.articleRepository
            .createQueryBuilder("article")
            .leftJoinAndSelect("article.author", "author")
            .leftJoinAndSelect("author.userDecorations", "authorDecorations")
            .leftJoinAndSelect("authorDecorations.decoration", "authorDecoration")
            .leftJoinAndSelect("article.category", "category")
            .leftJoinAndSelect("article.tags", "tags")
            .where(baseWhereCondition)
            .orderBy("article.sort", "DESC")
            .addOrderBy("article.createdAt", "DESC");

          fallbackQb.skip((page - 1) * limit).take(limit);
          const [fallbackData, fallbackTotal] = await fallbackQb.getManyAndCount();
          return this.processArticleResults(fallbackData, fallbackTotal, page, limit, user);
        }

        return this.processArticleResults(data, total, page, limit, user);
      }

      case "latest":
        findOptions = {
          where: baseWhereCondition,
          relations: commonRelations,
          order: {
            sort: "DESC" as const,
            createdAt: "DESC" as const,
          },
          ...commonPagination,
        };
        break;

      default:
        findOptions = {
          where: baseWhereCondition,
          relations: commonRelations,
          order: {
            sort: "DESC" as const,
            createdAt: "DESC" as const,
          },
          ...commonPagination,
        };
        break;
    }

    const [data, total] =
      await this.articleRepository.findAndCount(findOptions);

    return this.processArticleResults(data, total, page, limit, user);
  }

  /**
   * 全文搜索文章
   * 支持多字段搜索：标题、内容、摘要、标签、分类、作者用户名
   * 优先使用 Elasticsearch（如果已配置），否则回退到 TypeORM LIKE 查询
   * 支持按相关性、最新、浏览次数、点赞量排序
   * 搜索关键词会被记录到热搜统计中
   * @param keyword 搜索关键词
   * @param pagination 分页信息
   * @param categoryId 限制搜索的分类（包括其子分类）
   * @param sortBy 排序方式
   * @param user 当前用户
   */
  async searchArticles(
    keyword: string,
    pagination: PaginationDto,
    categoryId?: number,
    sortBy: "relevance" | "latest" | "views" | "likes" = "relevance",
    user?: User,
  ) {
    const { page, limit } = pagination;
    const normalizedKeyword = this.normalizeSearchKeyword(keyword);

    if (!normalizedKeyword) {
      return this.processArticleResults([], 0, page, limit, user);
    }

    const hasPermission =
      user && PermissionUtil.hasPermission(user, "article:manage");

    // 优先使用 Elasticsearch 搜索
    if (this.searchService.isElasticsearchEnabled()) {
      try {
        const esResult = await this.searchService.searchArticles({
          keyword: normalizedKeyword,
          page,
          limit,
          categoryId,
          sortBy,
          hasPermission,
          currentUserId: user?.id,
        });

        // 使用 ES 返回的 ID 列表查询完整数据
        let data: Article[] = [];
        if (esResult.ids.length > 0) {
          // 按照 ES 返回的 ID 顺序查询
          const articles = await this.articleRepository.find({
            where: { id: In(esResult.ids) },
            relations: [
              "author",
              "author.userDecorations",
              "author.userDecorations.decoration",
              "category",
              "tags",
              "downloads",
            ],
          });

          // 按照 ES 搜索结果的顺序排序
          const articleMap = new Map(articles.map((a) => [a.id, a]));
          data = esResult.ids
            .map((id) => articleMap.get(id))
            .filter((a): a is Article => a !== undefined);
        }

        // 记录热搜
        await this.recordHotSearch(normalizedKeyword);

        return this.processArticleResults(data, esResult.total, page, limit, user);
      } catch (error) {
        // ES 搜索失败时记录日志，并回退到数据库搜索
        console.log("ES 搜索失败，回退到数据库搜索:", error.message);
      }
    }

    // 回退到原有数据库搜索
    return this.searchArticlesFallback(
      normalizedKeyword,
      page,
      limit,
      categoryId,
      sortBy,
      user,
      hasPermission,
    );
  }

  /**
   * 数据库搜索回退方法（原有搜索逻辑）
   */
  private async searchArticlesFallback(
    normalizedKeyword: string,
    page: number,
    limit: number,
    categoryId?: number,
    sortBy: "relevance" | "latest" | "views" | "likes" = "relevance",
    user?: User,
    hasPermission?: boolean,
  ) {
    const categoryIds = categoryId
      ? await this.getCategoryAndDescendantIds(categoryId)
      : [];
    const keywordLike = `%${normalizedKeyword}%`;
    const keywordPrefix = `${normalizedKeyword}%`;

    const queryBuilder = this.articleRepository
      .createQueryBuilder("article")
      .leftJoinAndSelect("article.author", "author")
      .leftJoinAndSelect("author.userDecorations", "userDecorations")
      .leftJoinAndSelect("userDecorations.decoration", "decoration")
      .leftJoinAndSelect("article.category", "category")
      .leftJoinAndSelect("article.tags", "tags")
      .leftJoinAndSelect("article.downloads", "downloads")
      .distinct(true);

    if (!hasPermission) {
      queryBuilder.andWhere("article.status = :status", {
        status: "PUBLISHED",
      });
    }

    if (!user) {
      queryBuilder.andWhere("article.listRequireLogin = :listRequireLogin", {
        listRequireLogin: false,
      });
    }

    if (categoryId) {
      queryBuilder.andWhere("category.id IN (:...categoryIds)", {
        categoryIds: categoryIds.length > 0 ? categoryIds : [categoryId],
      });
    }

    queryBuilder.andWhere(
      new Brackets((qb) => {
        qb.where("article.title LIKE :keywordLike", { keywordLike })
          .orWhere("article.content LIKE :keywordLike", { keywordLike })
          .orWhere("article.summary LIKE :keywordLike", { keywordLike })
          .orWhere("tags.name LIKE :keywordLike", { keywordLike })
          .orWhere("category.name LIKE :keywordLike", { keywordLike })
          .orWhere("author.username LIKE :keywordLike", { keywordLike });
      }),
    );

    queryBuilder.addSelect(
      `(
        CASE
          WHEN article.title = :keywordExact THEN 100
          WHEN article.title LIKE :keywordPrefix THEN 80
          WHEN article.title LIKE :keywordLike THEN 60
          WHEN category.name LIKE :keywordLike THEN 40
          WHEN tags.name LIKE :keywordLike THEN 35
          WHEN author.username LIKE :keywordLike THEN 30
          WHEN article.summary LIKE :keywordLike THEN 20
          WHEN article.content LIKE :keywordLike THEN 10
          ELSE 0
        END
      )`,
      "relevanceScore",
    );

    queryBuilder.setParameters({
      keywordExact: normalizedKeyword,
      keywordPrefix,
      keywordLike,
    });

    this.applySearchSort(queryBuilder, sortBy);

    queryBuilder.skip((page - 1) * limit).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    if (normalizedKeyword && total > 0) {
      await this.recordHotSearch(normalizedKeyword);
    }

    return this.processArticleResults(data, total, page, limit, user);
  }

  /**
   * 获取热搜列表
   * 统计过去 7 天的搜索关键词频率，返回排名前 N 的热搜
   * 数据从 Redis 缓存中读取，避免数据库查询
   * @param limit 返回的热搜数量（1-50）
   */
  async getHotSearches(limit: number = 10, keyword?: string) {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 10, 50));
    const normalizedKeyword = this.normalizeSearchKeyword(keyword);
    const today = new Date();
    const keywordCounter = new Map<string, number>();

    for (let i = 0; i < ArticleService.HOT_SEARCH_DAYS; i += 1) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const cacheKey = this.getHotSearchCacheKey(date);
      const dailyData =
        (await this.cacheManager.get<Record<string, number>>(cacheKey)) || {};

      for (const [currentKeyword, count] of Object.entries(dailyData)) {
        keywordCounter.set(
          currentKeyword,
          (keywordCounter.get(currentKeyword) || 0) + count,
        );
      }
    }

    const data = [...keywordCounter.entries()]
      .map(([currentKeyword, count]) => ({ keyword: currentKeyword, count }))
      .filter((item) =>
        normalizedKeyword ? item.keyword.includes(normalizedKeyword) : true,
      )
      .sort((a, b) => {
        if (b.count !== a.count) {
          return b.count - a.count;
        }
        return a.keyword.localeCompare(b.keyword, "zh-CN");
      })
      .slice(0, safeLimit);

    return {
      success: true,
      data,
      keyword: normalizedKeyword || undefined,
    };
  }
  async findRelatedRecommendations(articleId: number, currentUser?: User) {
    const article = await this.articleRepository.findOne({
      where: { id: articleId },
      relations: ["category", "tags", "author", "downloads"],
    });

    if (!article) {
      return ListUtil.buildPaginatedList([], 0, 1, 5);
    }
    const hasPermission =
      currentUser &&
      PermissionUtil.hasPermission(currentUser, "article:manage");
    const isAuthor = currentUser && currentUser.id === article.authorId;

    if (article.status !== "PUBLISHED" && !hasPermission && !isAuthor) {
      return ListUtil.buildPaginatedList([], 0, 1, 5);
    }
    const { category, tags } = article;
    const categoryId = category?.id;
    const tagIds = tags
      ?.map((tag) => tag.id)
      .filter((id) => id && !isNaN(Number(id)));
    if (
      (!categoryId || isNaN(Number(categoryId))) &&
      (!tagIds || tagIds.length === 0)
    ) {
      return ListUtil.buildPaginatedList([], 0, 1, 5);
    }

    const whereConditions: FindOptionsWhere<Article> = {
      ...(hasPermission ? {} : { status: "PUBLISHED" }),
      ...(!currentUser && { listRequireLogin: false }),
      ...(categoryId &&
        !isNaN(Number(categoryId)) && { category: { id: categoryId } }),
      ...(tagIds && tagIds.length > 0 && { tags: { id: In(tagIds) } }),
    };
    let relatedArticles: Article[] = [];
    if (Object.keys(whereConditions).length > 0) {
      const allRelatedArticles = await this.articleRepository.find({
        where: whereConditions,
        relations: [
          "author",
          "author.userDecorations",
          "author.userDecorations.decoration",
          "category",
          "tags",
          "downloads",
        ],
        order: {
          createdAt: "DESC",
        },
        take: 30,
      });
      const availableArticles = allRelatedArticles.filter(
        (article) => article.id !== articleId,
      );
      if (availableArticles.length > 5) {
        const latestArticles = availableArticles.slice(
          0,
          Math.ceil(availableArticles.length * 0.6),
        );
        const otherArticles = availableArticles.slice(
          Math.ceil(availableArticles.length * 0.6),
        );
        const selectedLatest = this.shuffleArray(latestArticles).slice(0, 3);
        const selectedOthers = this.shuffleArray(otherArticles).slice(0, 2);
        relatedArticles = this.shuffleArray([
          ...selectedLatest,
          ...selectedOthers,
        ]);
      } else {
        relatedArticles = availableArticles;
      }
      if (relatedArticles.length < 5) {
        const remainingCount = 5 - relatedArticles.length;
        const existingIds = relatedArticles.map((article) => article.id);
        const latestArticles = await this.articleRepository.find({
          where: {
            ...(hasPermission ? {} : { status: "PUBLISHED" }),
            ...(!currentUser && { listRequireLogin: false }),
            id: Not(In([...existingIds, articleId])),
          },
          relations: [
            "author",
            "author.userDecorations",
            "author.userDecorations.decoration",
            "category",
            "tags",
            "downloads",
          ],
          order: {
            createdAt: "DESC",
          },
          take: remainingCount * 3,
        });
        if (latestArticles.length < remainingCount) {
          const popularArticles = await this.articleRepository.find({
            where: {
              ...(hasPermission ? {} : { status: "PUBLISHED" }),
              ...(!currentUser && { listRequireLogin: false }),
              id: Not(
                In([
                  ...existingIds,
                  articleId,
                  ...latestArticles.map((a) => a.id),
                ]),
              ),
            },
            relations: [
              "author",
              "author.userDecorations",
              "author.userDecorations.decoration",
              "category",
              "tags",
              "downloads",
            ],
            order: {
              views: "DESC",
              createdAt: "DESC",
            },
            take: (remainingCount - latestArticles.length) * 2,
          });
          const allSupplementArticles = [...latestArticles, ...popularArticles];
          const shuffledSupplement = this.shuffleArray(allSupplementArticles);
          relatedArticles = [
            ...relatedArticles,
            ...shuffledSupplement.slice(0, remainingCount),
          ];
        } else {
          const shuffledLatest = this.shuffleArray(latestArticles);
          relatedArticles = [
            ...relatedArticles,
            ...shuffledLatest.slice(0, remainingCount),
          ];
        }
      }
    }
    return this.processArticleResults(
      relatedArticles,
      relatedArticles.length,
      1,
      5,
      currentUser,
    );
  }
  async incrementViews(id: number) {
    const article = await this.articleRepository.findOne({ where: { id } });
    if (!article) {
      throw new NotFoundException("response.error.articleNotFound");
    }
    return await this.articleRepository.increment({ id: id }, "views", 1);
  }
  async publishArticle(id: number) {
    const article = await this.articleRepository.findOne({
      where: { id },
      relations: ["category", "tags"],
    });

    if (!article) {
      throw new NotFoundException("response.error.articleNotFound");
    }
    if (article.status !== "PUBLISHED") {
      await this.articleRepository.update(id, { status: "PUBLISHED" });
      if (article.category) {
        await this.categoryRepository.increment(
          { id: article.category.id },
          "articleCount",
          1,
        );
      }
      if (article.tags && article.tags.length > 0) {
        for (const tag of article.tags) {
          await this.tagRepository.increment({ id: tag.id }, "articleCount", 1);
        }
      }
    }

    return { success: true, message: "response.success.articlePublished" };
  }
  async unpublishArticle(id: number) {
    const article = await this.articleRepository.findOne({
      where: { id },
      relations: ["category", "tags"],
    });

    if (!article) {
      throw new NotFoundException("response.error.articleNotFound");
    }
    if (article.status === "PUBLISHED") {
      await this.articleRepository.update(id, { status: "DRAFT" });
      if (article.category) {
        await this.categoryRepository.decrement(
          { id: article.category.id },
          "articleCount",
          1,
        );
      }
      if (article.tags && article.tags.length > 0) {
        for (const tag of article.tags) {
          await this.tagRepository.decrement({ id: tag.id }, "articleCount", 1);
        }
      }
    }

    return { success: true, message: "response.success.articleUnpublished" };
  }
  private async checkUserMembershipStatus(user: User) {
    try {
      return (
        user.membershipStatus === "ACTIVE" &&
        user.membershipLevel > 0 &&
        (user.membershipEndDate === null || user.membershipEndDate > new Date())
      );
    } catch (error) {
      console.error("检查用户会员状态失败", error);
      return false;
    }
  }
  private async addAuthorStatusInfo(author: User, currentUser?: User) {
    const isMember = await this.checkUserMembershipStatus(author);

    const isFollowed = currentUser
      ? await this.userService.isFollowing(currentUser.id, author.id)
      : false;

    return {
      ...author,
      isMember,
      isFollowed,
    };
  }
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
  async getPublishedArticleIds() {
    const articles = await this.articleRepository.find({
      where: { status: "PUBLISHED", listRequireLogin: false },
      select: ["id", "updatedAt"],
      order: { createdAt: "DESC" },
    });
    const data = articles.map((article) => {
      return {
        id: article.id,
        updatedAt: article.updatedAt,
      };
    });
    return data;
  }

  async getLikedArticles(user: User, pagination: PaginationDto) {
    const [likedArticles, total] =
      await this.articleLikeRepository.findAndCount({
        where: { userId: user.id },
        relations: [
          "article",
          "article.author",
          "article.author.userDecorations",
          "article.author.userDecorations.decoration",
          "article.category",
          "article.tags",
          "article.downloads",
        ],
      });
    return this.processArticleResults(
      likedArticles.map((like) => like.article),
      total,
      pagination.page,
      pagination.limit,
      user,
    );
  }

  /**
   * 记录用户的文章浏览历史
   * 业务流程：验证文章存在、创建或更新浏览记录（包含浏览次数、进度、时长）
   * @param userId 用户ID
   * @param articleId 文章ID
   * @param recordDto 浏览数据（阅读进度、观看时长）
   */
  async recordBrowseHistory(
    userId: number,
    articleId: number,
    recordDto?: RecordBrowseHistoryDto,
  ) {
    const article = await this.articleRepository.findOne({
      where: { id: articleId },
    });

    if (!article) {
      throw new NotFoundException("response.error.articleNotFound");
    }
    let browseHistory = await this.browseHistoryRepository.findOne({
      where: { userId, articleId },
    });

    if (browseHistory) {
      browseHistory.viewCount += 1;
      if (recordDto?.progress !== undefined) {
        browseHistory.progress = Math.max(
          browseHistory.progress,
          recordDto.progress,
        );
      }
      if (recordDto?.duration !== undefined) {
        browseHistory.duration += recordDto.duration;
      }
      browseHistory.updatedAt = new Date();
    } else {
      browseHistory = this.browseHistoryRepository.create({
        userId,
        articleId,
        viewCount: 1,
        progress: recordDto?.progress || 0,
        duration: recordDto?.duration || 0,
      });
    }

    await this.browseHistoryRepository.save(browseHistory);

    return {
      success: true,
      message: "response.success.browseHistoryRecorded",
      data: browseHistory,
    };
  }
  async updateBrowseProgress(
    userId: number,
    articleId: number,
    recordDto: RecordBrowseHistoryDto,
  ) {
    const browseHistory = await this.browseHistoryRepository.findOne({
      where: { userId, articleId },
    });

    if (!browseHistory) {
      return this.recordBrowseHistory(userId, articleId, recordDto);
    }

    const { progress, duration } = recordDto;

    if (progress !== undefined) {
      browseHistory.progress = Math.max(browseHistory.progress, progress);
    }

    if (duration !== undefined) {
      browseHistory.duration += duration;
    }

    browseHistory.updatedAt = new Date();
    await this.browseHistoryRepository.save(browseHistory);

    return {
      success: true,
      message: "response.success.browseHistoryUpdated",
      data: browseHistory,
    };
  }
  async getUserBrowseHistory(userId: number, queryDto: QueryBrowseHistoryDto) {
    const { page, limit, startDate, endDate, categoryId } = queryDto;

    const queryBuilder = this.browseHistoryRepository
      .createQueryBuilder("browseHistory")
      .leftJoinAndSelect("browseHistory.article", "article")
      .leftJoinAndSelect("article.author", "author")
      .leftJoinAndSelect("author.userDecorations", "userDecorations")
      .leftJoinAndSelect("userDecorations.decoration", "decoration")
      .leftJoinAndSelect("article.category", "category")
      .leftJoinAndSelect("article.tags", "tags")
      .where("browseHistory.userId = :userId", { userId })
      .andWhere("article.status = :status", { status: "PUBLISHED" });
    if (startDate && endDate) {
      queryBuilder.andWhere(
        "browseHistory.updatedAt BETWEEN :startDate AND :endDate",
        {
          startDate: new Date(startDate),
          endDate: new Date(endDate),
        },
      );
    } else if (startDate) {
      queryBuilder.andWhere("browseHistory.updatedAt >= :startDate", {
        startDate: new Date(startDate),
      });
    } else if (endDate) {
      queryBuilder.andWhere("browseHistory.updatedAt <= :endDate", {
        endDate: new Date(endDate),
      });
    }
    if (categoryId) {
      queryBuilder.andWhere("article.categoryId = :categoryId", { categoryId });
    }
    queryBuilder
      .orderBy("browseHistory.updatedAt", "DESC")
      .skip((page - 1) * limit)
      .take(limit);

    const [histories, total] = await queryBuilder.getManyAndCount();
    const processedHistories = histories.map((history) => ({
      id: history.id,
      viewCount: history.viewCount,
      progress: history.progress,
      duration: history.duration,
      createdAt: history.createdAt,
      updatedAt: history.updatedAt,
      article: history.article
        ? {
            id: history.article.id,
            title: history.article.title,
            cover: history.article.cover,
            summary: history.article.summary,
            views: history.article.views,
            likes: history.article.likes,
            commentCount: history.article.commentCount,
            status: history.article.status,
            createdAt: history.article.createdAt,
            updatedAt: history.article.updatedAt,
            author: history.article.author
              ? sanitizeUser(processUserDecorations(history.article.author))
              : null,
            category: history.article.category,
            tags: history.article.tags,
          }
        : null,
    }));

    return ListUtil.buildPaginatedList(processedHistories, total, page, limit);
  }
  async getBrowseHistory(userId: number, articleId: number) {
    const browseHistory = await this.browseHistoryRepository.findOne({
      where: { userId, articleId },
      relations: [
        "article",
        "article.author",
        "article.author.userDecorations",
        "article.author.userDecorations.decoration",
        "article.category",
        "article.tags",
      ],
    });

    if (!browseHistory) {
      return null;
    }

    return {
      ...browseHistory,
      article: browseHistory.article
        ? {
            ...browseHistory.article,
            author: browseHistory.article.author
              ? sanitizeUser(
                  processUserDecorations(browseHistory.article.author),
                )
              : null,
          }
        : null,
    };
  }
  async deleteBrowseHistory(userId: number, articleId: number) {
    const browseHistory = await this.browseHistoryRepository.findOne({
      where: { userId, articleId },
    });

    if (!browseHistory) {
      throw new NotFoundException("response.error.browseHistoryNotFound");
    }

    await this.browseHistoryRepository.remove(browseHistory);

    return {
      success: true,
      message: "response.success.browseHistoryDeleted",
    };
  }
  async batchDeleteBrowseHistory(userId: number, articleIds: number[]) {
    await this.browseHistoryRepository.delete({
      userId,
      articleId: In(articleIds),
    });

    return {
      success: true,
      message: "response.success.browseHistoryBatchDeleted",
    };
  }
  async clearBrowseHistory(userId: number) {
    await this.browseHistoryRepository.delete({ userId });

    return {
      success: true,
      message: "response.success.browseHistoryCleared",
    };
  }
  async getBrowseStats(userId: number) {
    const queryBuilder = this.browseHistoryRepository
      .createQueryBuilder("browseHistory")
      .where("browseHistory.userId = :userId", { userId });
    const totalCount = await queryBuilder.getCount();
    const totalViewsResult = await queryBuilder
      .select("SUM(browseHistory.viewCount)", "total")
      .getRawOne();
    const totalViews = parseInt(totalViewsResult?.total || "0");
    const totalDurationResult = await queryBuilder
      .select("SUM(browseHistory.duration)", "total")
      .getRawOne();
    const totalDuration = parseInt(totalDurationResult?.total || "0");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = await this.browseHistoryRepository.count({
      where: {
        userId,
        updatedAt: MoreThanOrEqual(today),
      },
    });
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    weekAgo.setHours(0, 0, 0, 0);
    const weekCount = await this.browseHistoryRepository.count({
      where: {
        userId,
        updatedAt: MoreThanOrEqual(weekAgo),
      },
    });
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
    monthAgo.setHours(0, 0, 0, 0);
    const monthCount = await this.browseHistoryRepository.count({
      where: {
        userId,
        updatedAt: MoreThanOrEqual(monthAgo),
      },
    });

    return {
      totalCount,
      totalViews,
      totalDuration,
      todayCount,
      weekCount,
      monthCount,
    };
  }
  async getRecentBrowsedArticles(userId: number, limit: number = 10) {
    const histories = await this.browseHistoryRepository.find({
      where: { userId },
      relations: [
        "article",
        "article.author",
        "article.author.userDecorations",
        "article.author.userDecorations.decoration",
        "article.category",
        "article.tags",
      ],
      order: { updatedAt: "DESC" },
      take: limit,
    });

    return histories
      .filter((h) => h.article && h.article.status === "PUBLISHED")
      .map((history) => ({
        ...history.article,
        author: history.article.author
          ? sanitizeUser(processUserDecorations(history.article.author))
          : null,
        lastBrowsedAt: history.updatedAt,
        browseProgress: history.progress,
      }));
  }
  async favoriteArticle(articleId: number, userId: number) {
    const article = await this.articleRepository.findOne({
      where: { id: articleId },
      relations: ["author"],
    });

    if (!article) {
      throw new NotFoundException("response.error.articleNotFound");
    }
    const existingFavorite = await this.articleFavoriteRepository.findOne({
      where: { userId, articleId },
    });

    if (existingFavorite) {
      throw new BadRequestException("response.error.alreadyFavorited");
    }
    const favorite = this.articleFavoriteRepository.create({
      userId,
      articleId,
    });

    await this.articleFavoriteRepository.save(favorite);
    await this.articleRepository.increment(
      { id: articleId },
      "favoriteCount",
      1,
    );
    try {
      this.eventEmitter.emit("article.favorited", {
        userId,
        articleId,
        articleTitle: article.title,
      });
      if (article.author?.id && article.author.id !== userId) {
        this.eventEmitter.emit("article.receivedFavorite", {
          authorId: article.author.id,
          articleId,
          favoriterId: userId,
        });
      }
    } catch (error) {
      console.error("触发文章收藏事件失败", error);
    }

    return {
      success: true,
      message: "response.success.articleFavorited",
      data: {
        favoriteId: favorite.id,
        createdAt: favorite.createdAt,
      },
    };
  }
  async unfavoriteArticle(articleId: number, userId: number) {
    const favorite = await this.articleFavoriteRepository.findOne({
      where: { userId, articleId },
    });

    if (!favorite) {
      throw new NotFoundException("response.error.favoriteNotFound");
    }
    await this.articleFavoriteRepository.remove(favorite);
    await this.articleRepository.decrement(
      { id: articleId },
      "favoriteCount",
      1,
    );

    return {
      success: true,
      message: "response.success.articleUnfavorited",
    };
  }
  async checkFavoriteStatus(articleId: number, userId: number) {
    const favorite = await this.articleFavoriteRepository.findOne({
      where: { userId, articleId },
    });

    return {
      isFavorited: !!favorite,
      favoritedAt: favorite?.createdAt,
    };
  }

  /**
   * 获取用户收藏的文章列表
   * 隐私检查：如果用户隐藏了收藏列表，只有自己可以查看
   * @param targetUserId 目标用户ID
   * @param currentUser 当前用户（用于隐私检查）
   * @param pagination 分页信息
   */
  async getFavoritedArticles(
    targetUserId: number,
    currentUser: User | undefined,
    pagination: PaginationDto,
  ) {
    const { page, limit } = pagination;
    if (targetUserId !== currentUser?.id) {
      const targetUserConfig = await this.userConfigRepository.findOne({
        where: { userId: targetUserId },
      });
      if (targetUserConfig?.hideFavorites) {
        return ListUtil.buildPaginatedList([], 0, page, limit);
      }
    }

    const queryBuilder = this.articleFavoriteRepository
      .createQueryBuilder("favorite")
      .leftJoinAndSelect("favorite.article", "article")
      .leftJoinAndSelect("article.author", "author")
      .leftJoinAndSelect("author.userDecorations", "userDecorations")
      .leftJoinAndSelect("userDecorations.decoration", "decoration")
      .leftJoinAndSelect("article.category", "category")
      .leftJoinAndSelect("article.tags", "tags")
      .leftJoinAndSelect("article.downloads", "downloads")
      .where("favorite.userId = :userId", { userId: targetUserId })
      .andWhere("article.status = :status", { status: "PUBLISHED" })
      .orderBy("favorite.createdAt", "DESC");

    const [favorites, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    const articles = favorites
      .filter((fav) => fav.article)
      .map((fav) => {
        const article = fav.article;
        (article as any).favoritedAt = fav.createdAt;
        return article;
      });
    return this.processArticleResults(
      articles,
      total,
      page,
      limit,
      currentUser,
    );
  }
  async getTelegramDownloadLink(downloadId: number, user: User) {
    const download = await this.downloadRepository.findOne({
      where: { id: downloadId },
      relations: ["article"],
    });

    if (!download) {
      throw new NotFoundException("response.error.downloadNotFound");
    }

    if (download.type !== DownloadType.TELEGRAM) {
      throw new BadRequestException(
        "response.error.onlyTelegramDownloadSupported",
      );
    }
    await this.checkArticleDownloadAccess(download.article, user);

    return this.telegramDownloadService.getFileDownloadUrl(download.url);
  }
  private async checkArticleDownloadAccess(article: Article, user: User) {
    if (article.authorId === user.id) {
      return;
    }
    if (PermissionUtil.hasPermission(user, "article:manage")) {
      return;
    }
    if (article.viewPrice > 0) {
      const hasPaid = await this.orderService.hasPaidForArticle(
        user.id,
        article.id,
      );
      if (!hasPaid) {
        throw new ForbiddenException("response.error.articleNotPurchased");
      }
    }
  }
}
