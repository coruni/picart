import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import {
  Like,
  Repository,
  In,
  Not,
  MoreThan,
  MoreThanOrEqual,
  FindManyOptions,
  FindOptionsWhere,
} from "typeorm";
import { CreateArticleDto } from "./dto/create-article.dto";
import { UpdateArticleDto } from "./dto/update-article.dto";
import { Article } from "./entities/article.entity";
import { User } from "../user/entities/user.entity";
import { Category } from "../category/entities/category.entity";
import { Tag } from "../tag/entities/tag.entity";
import { ArticleLike } from "./entities/article-like.entity";
import { Download } from "./entities/download.entity";
import { BrowseHistory } from "./entities/browse-history.entity";
import { PaginationDto } from "src/common/dto/pagination.dto";
import { PermissionUtil, sanitizeUser, ListUtil, processUserDecorations } from "src/common/utils";
import { TagService } from "../tag/tag.service";
import { UserService } from "../user/user.service";
import { OrderService } from "../order/order.service";
import { ArticleLikeDto } from "./dto/article-reaction.dto";
import { RecordBrowseHistoryDto } from "./dto/record-browse-history.dto";
import { QueryBrowseHistoryDto } from "./dto/query-browse-history.dto";
import { ConfigService } from "../config/config.service";
import { EnhancedNotificationService } from "../message/enhanced-notification.service";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { FavoriteItem } from "../favorite/entities/favorite-item.entity";

@Injectable()
export class ArticleService {
  constructor(
    @InjectRepository(Article)
    private articleRepository: Repository<Article>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    @InjectRepository(Tag)
    private tagRepository: Repository<Tag>,
    @InjectRepository(ArticleLike)
    private articleLikeRepository: Repository<ArticleLike>,
    @InjectRepository(Download)
    private downloadRepository: Repository<Download>,
    @InjectRepository(BrowseHistory)
    private browseHistoryRepository: Repository<BrowseHistory>,
    @InjectRepository(FavoriteItem)
    private favoriteItemRepository: Repository<FavoriteItem>,
    private tagService: TagService,
    private userService: UserService,
    private orderService: OrderService,
    private configService: ConfigService,
    private enhancedNotificationService: EnhancedNotificationService,
    private eventEmitter: EventEmitter2,
  ) { }

  /**
   * 创建文章
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
    const hasPermission = PermissionUtil.hasPermission(
      author,
      "article:manage",
    );
    // 查找分类
    const category = await this.categoryRepository.findOne({
      where: { id: categoryId },
    });
    if (!category) {
      throw new NotFoundException("response.error.categoryNotFound");
    }

    // 处理 images 字段：如果是数组则转换为逗号分隔的字符串
    if (articleData.images && Array.isArray(articleData.images)) {
      articleData.images = articleData.images.join(",");
    }

    // 创建文章
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

    // 判断是否需要审核
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

    // 处理标签
    const tags: Tag[] = [];

    // 如果有标签ID，查找现有标签
    if (tagIds && tagIds.length > 0) {
      const existingTags = await this.tagRepository.find({
        where: { id: In(tagIds) },
      });
      tags.push(...existingTags);
    }

    // 如果有标签名称，创建或查找标签
    if (tagNames && tagNames.length > 0) {
      const createdTags = await this.tagService.findOrCreateTags(tagNames);
      // 避免重复添加
      createdTags.forEach((tag) => {
        if (!tags.find((t) => t.id === tag.id)) {
          tags.push(tag);
        }
      });
    }

    article.tags = tags;
    const savedArticle = await this.articleRepository.save(article);

    // 处理下载资源
    if (downloads && downloads.length > 0) {
      const downloadEntities = downloads.map((downloadData) =>
        this.downloadRepository.create({
          ...downloadData,
          articleId: savedArticle.id,
        }),
      );
      await this.downloadRepository.save(downloadEntities);
    }

    // 重新查询文章以包含下载资源和作者装饰品
    const articleWithDownloads = await this.articleRepository.findOne({
      where: { id: savedArticle.id },
      relations: ["author", "author.userDecorations", "author.userDecorations.decoration", "category", "tags", "downloads"],
    });

    // 处理图片字段
    this.processArticleImages(articleWithDownloads!);

    // 添加imageCount字段
    if (articleWithDownloads) {
      articleWithDownloads['imageCount'] = articleWithDownloads.images ?
        (typeof articleWithDownloads.images === "string" ?
          articleWithDownloads.images.split(",").filter(img => img.trim() !== "").length :
          articleWithDownloads.images.length) : 0;
    }

    // 增加用户发布文章数量
    this.userService.incrementArticleCount(author.id);
    // 增加分类文章数量
    this.categoryRepository.increment({ id: category.id }, "articleCount", 1);
    // 增加标签文章数量
    tags.forEach((tag) => {
      this.tagRepository.increment({ id: tag.id }, "articleCount", 1);
    });

    // 触发文章创建事件（用于积分系统）
    if (savedArticle.status === 'PUBLISHED') {
      try {
        this.eventEmitter.emit('article.created', {
          userId: author.id,
          articleId: savedArticle.id,
        });
      } catch (error) {
        console.error("触发文章创建事件失败:", error);
      }
    }

    // 处理作者装饰品并清理敏感信息
    if (articleWithDownloads?.author) {
      articleWithDownloads.author = sanitizeUser(processUserDecorations(articleWithDownloads.author));
    }
    return {
      success: true,
      message: "response.success.articleCreate",
      data: articleWithDownloads,
    };
  }

  /**
   * 分页查询所有文章
   */
  async findAllArticles(
    pagination: PaginationDto,
    title?: string,
    categoryId?: number,
    user?: User,
    type?: "all" | "popular" | "latest" | "following",
  ) {
    const hasPermission =
      user && PermissionUtil.hasPermission(user, "article:manage");

    // 基础条件映射器
    const baseConditionMappers = [
      // 非管理员只查询已发布文章
      () => !hasPermission && { status: "PUBLISHED" as const },
      // 未登录用户不显示标记为仅登录可见的列表项
      () => !user && { listRequireLogin: false },
      // 根据标题模糊查询
      () => title && { title: Like(`%${title}%`) },
      // 根据分类ID查询
      () => categoryId && { category: { id: categoryId } },
    ];

    // 合并基础条件
    const baseWhereCondition = baseConditionMappers
      .map((mapper) => mapper())
      .filter(Boolean)
      .reduce((acc, curr) => ({ ...acc, ...curr }), {});

    const { page, limit } = pagination;

    // 提取公共的查询配置（添加装饰品关联）
    const commonRelations = ["author", "author.userDecorations", "author.userDecorations.decoration", "category", "tags", "downloads"];
    const commonPagination = {
      skip: (page - 1) * limit,
      take: limit,
    };

    let findOptions: FindManyOptions<Article>;

    // 根据type类型构建不同的查询条件
    switch (type) {
      case "popular":
        // 热门文章（按浏览量排序）
        // 如果一个月内没有文章，则不限制时间范围
        const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        // 先尝试查询一个月内的文章
        findOptions = {
          where: {
            ...baseWhereCondition,
            createdAt: MoreThan(oneMonthAgo),
          },
          relations: commonRelations,
          order: {
            sort: "DESC" as const,
            views: "DESC",
            createdAt: "DESC" as const,
          },
          ...commonPagination,
        };

        // 检查一个月内是否有文章，如果没有则不限制时间范围
        const popularTotal = await this.articleRepository.count(findOptions);

        if (popularTotal === 0) {
          // 如果一个月内没有文章，则查询所有文章
          findOptions = {
            where: baseWhereCondition,
            relations: commonRelations,
            order: {
              sort: "DESC" as const,
              views: "DESC",
              createdAt: "DESC" as const,
            },
            ...commonPagination,
          };
        }

        break;

      case "latest":
        // 最新文章
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
        // 用户关注的作者文章（需要用户登录）
        if (!user) {
          // 如果用户未登录，返回空列表
          return ListUtil.buildPaginatedList([], 0, page, limit);
        }

        // 获取用户关注的作者ID列表
        const followingUsers = await this.userService
          .getUserRepository()
          .createQueryBuilder("user")
          .innerJoin("user.followers", "follower", "follower.id = :userId", {
            userId: user.id,
          })
          .getMany();

        const followingUserIds = followingUsers.map((u) => u.id);

        // 如果没有关注任何作者，返回空列表
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
            // 先按排序，然后按最新优先，最后按热度
            sort: "DESC" as const,
            createdAt: "DESC" as const,
            views: "DESC" as const,
          },
          ...commonPagination,
        };
        break;

      default:
        // all 或未指定type时使用默认查询
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
   * 处理文章结果，包括分类父级处理、图片处理和权限检查
   */
  private async processArticleResults(
    data: Article[],
    total: number,
    page: number,
    limit: number,
    user?: User,
  ) {
    // 处理分类的父级分类
    for (const article of data) {
      if (article.category && article.category.parentId) {
        // 检查parentId是否是自己
        if (article.category.parentId !== article.category.id) {
          const parentCategory = await this.categoryRepository.findOne({
            where: { id: article.category.parentId },
          });
          if (parentCategory) {
            article.category.parent = parentCategory;
          }
        }
      }
      // 处理图片
      this.processArticleImages(article);
    }

    // 查询用户点赞状态 - 新增代码
    let userLikedArticleIds: Set<number> = new Set();
    if (user) {
      const articleIds = data.map((article) => article.id);
      const userLikes = await this.articleLikeRepository.find({
        where: {
          user: { id: user.id },
          article: { id: In(articleIds) },
        },
        relations: ["article"],
      });
      // 修正：过滤掉 article 为 undefined 的记录
      userLikedArticleIds = new Set(
        userLikes
          .filter((like) => like.article) // 确保 article 存在
          .map((like) => like.article.id),
      );
    }

    // 处理每篇文章的权限和内容裁剪
    const processedArticles = await Promise.all(
      data.map(async (article) => {
        const processedArticle = await this.processArticlePermissions(
          article,
          user,
          userLikedArticleIds.has(article.id),
        );

        // 添加作者的完整状态信息（包括装饰品）
        processedArticle.author = await this.addAuthorStatusInfo(
          processUserDecorations(processedArticle.author),
          user,
        );
        return processedArticle;
      }),
    );

    return ListUtil.buildPaginatedList(processedArticles, total, page, limit);
  }

  /**
   * 根据ID查询文章详情
   */
  async findOne(id: number, currentUser?: User) {
    // 是否有权限查看未发布的文章
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

    // 处理分类的父级分类
    if (article.category && article.category.parentId) {
      // 检查parentId是否是自己
      if (article.category.parentId !== article.category.id) {
        const parentCategory = await this.categoryRepository.findOne({
          where: { id: article.category.parentId },
        });
        if (parentCategory) {
          article.category.parent = parentCategory;
        }
      }
    }

    // 检查当前用户是否点赞该文章
    let isLiked = false;
    if (currentUser) {
      const userLike = await this.articleLikeRepository.findOne({
        where: {
          user: { id: currentUser.id },
          article: { id: article.id },
        },
      });
      isLiked = !!userLike;
    }

    // 增加阅读量
    await this.incrementViews(id);

    // 记录浏览历史（如果用户已登录）
    if (currentUser) {
      try {
        await this.recordBrowseHistory(currentUser.id, id);
      } catch (error) {
        // 浏览历史记录失败不影响主流程
        console.error('记录浏览历史失败:', error);
      }
    }

    // 处理图片字段
    this.processArticleImages(article);

    // 使用通用方法处理权限和内容裁剪
    const processedArticle = await this.processArticlePermissions(
      article,
      currentUser,
      isLiked,
    );

    // 添加作者的完整状态信息（包括装饰品）
    if (processedArticle.author) {
      processedArticle.author = await this.addAuthorStatusInfo(
        processUserDecorations(processedArticle.author),
        currentUser,
      );
    }

    // 处理收藏夹信息：只显示文章作者创建的一个收藏夹，排除用户信息
    if (processedArticle.author) {
      const authorFavoriteItem = await this.favoriteItemRepository.findOne({
        where: {
          articleId: processedArticle.id,
          userId: processedArticle.author.id,
        },
        relations: ['favorite', 'favorite.items', 'favorite.items.article'],
        order: { createdAt: 'DESC' }, // 获取最新的一个
      });

      if (authorFavoriteItem && authorFavoriteItem.favorite) {
        const { user, userId, items, ...favoriteData } = authorFavoriteItem.favorite;

        // 从 items 中找上一篇和下一篇
        const currentSort = authorFavoriteItem.sort;
        const publishedItems = items
          .filter(item => item.article && item.article.status === 'PUBLISHED')
          .sort((a, b) => a.sort - b.sort);

        const currentIndex = publishedItems.findIndex(item => item.id === authorFavoriteItem.id);
        const prevItem = currentIndex > 0 ? publishedItems[currentIndex - 1] : null;
        const nextItem = currentIndex < publishedItems.length - 1 ? publishedItems[currentIndex + 1] : null;

        // 将收藏夹信息和导航信息一起放到 favorite 中
        (processedArticle as any).favorite = {
          ...favoriteData,
          navigation: {
            prev: prevItem && prevItem.article
              ? {
                  id: prevItem.article.id,
                  title: prevItem.article.title,
                  cover: prevItem.article.cover,
                }
              : null,
            next: nextItem && nextItem.article
              ? {
                  id: nextItem.article.id,
                  title: nextItem.article.title,
                  cover: nextItem.article.cover,
                }
              : null,
          },
        };
      }
    }
    
    return processedArticle;
  }

  /**
   * 处理文章图片字段
   */
  private processArticleImages(article: Article) {
    if (article.images) {
      if (typeof article.images === "string") {
        article.images = article.images
          .split(",")
          .filter((img) => img.trim() !== "") as any;
      }
    } else {
      article.images = [] as any;
    }
  }

  /**
   * 裁剪文章内容
   * @param article 文章对象
   * @param restrictionType 限制类型
   * @param price 价格
   */
  private async cropArticleContent(
    article: Article,
    restrictionType: string,
    price?: number,
  ) {
    // 获取配置的免费图片数量（自动使用缓存）
    const freeImagesCount =
      await this.configService.getArticleFreeImagesCount();

    // 处理图片，保留配置的免费图片数量
    let previewImages: string[] = [];

    if (article.images) {
      let imageArray: string[] = [];

      // 处理可能是字符串或数组的情况
      if (typeof article.images === "string") {
        imageArray = article.images
          .split(",")
          .filter((img: string) => img.trim() !== "");
      } else if (Array.isArray(article.images)) {
        imageArray = (article.images as string[]).filter(
          (img: string) => img && img.trim() !== "",
        );
      }

      previewImages = imageArray.slice(0, freeImagesCount);
    }

    // 根据文章类型决定裁剪策略
    if (article.type === "mixed") {
      // mixed类型：只隐藏下载信息，保留文章内容和所有图片
      const croppedArticle = {
        ...article,
        downloads: [], // 隐藏下载资源
        imageCount: article.images.length || 0,
        downloadCount: article.downloads ? article.downloads.length : 0, // 显示资源数量
      };
      return croppedArticle;
    } else {
      // image类型：保持原来的逻辑，隐藏内容和限制图片
      const croppedArticle = {
        ...article,
        images: previewImages as any, // 保留配置的免费图片数量
        imageCount: article.images.length || 0,
        downloads: [], // 隐藏下载资源
        downloadCount: article.downloads ? article.downloads.length : 0, // 显示资源数量
      };
      return croppedArticle;
    }
  }

  /**
   * 提取公共的返回对象结构（处理装饰品）
   */
  private getBaseResponse(author: User, isLiked: boolean, downloads: any[]) {
    return {
      author: sanitizeUser(processUserDecorations(author)),
      downloads: [],
      downloadCount: downloads ? downloads.length : 0,
      isLiked,
    };
  }

  /**
   * 处理文章权限和内容裁剪（通用方法）
   * @param article 文章对象
   * @param user 当前用户
   * @param isLiked 是否已点赞
   */
  private async processArticlePermissions(
    article: Article,
    user?: User,
    isLiked: boolean = false,
  ) {
    // 检查是否是作者或管理员
    const isAuthor = user && user.id === article.author.id;
    const isAdmin =
      user && PermissionUtil.hasPermission(user, "article:manage");
    const hasFullAccess = isAuthor || isAdmin;

    // 检查用户是否已支付（用于 isPaid 字段）
    let isPaid = false;
    if (user && article.requirePayment) {
      isPaid = await this.checkUserPaymentStatus(user.id, article.id);
    }

    // 提取公共的返回对象结构（使用新方法）
    const baseResponse = this.getBaseResponse(article.author, isLiked, article.downloads);

    // 如果没有完整权限，进行内容裁剪
    if (!hasFullAccess) {
      // 检查登录权限 - 如果设置了登录权限但用户未登录，直接返回裁剪内容
      if (article.requireLogin && !user) {
        return {
          ...(await this.cropArticleContent(article, "login")),
          ...baseResponse,
          isPaid: false,
        };
      }

      // 如果设置了任何权限但用户未登录，直接返回登录提示
      if (
        (article.requireFollow ||
          article.requireMembership ||
          article.requirePayment) &&
        !user
      ) {
        return {
          ...(await this.cropArticleContent(article, "login")),
          ...baseResponse,
          isPaid: false,
        };
      }

      // 检查关注权限
      if (article.requireFollow && user) {
        const hasFollowed = await this.checkUserFollowStatus(
          user.id,
          article.author.id,
        );
        if (!hasFollowed) {
          return {
            ...(await this.cropArticleContent(article, "follow")),
            ...baseResponse,
            isPaid,
          };
        }
      }

      // 检查会员权限
      if (article.requireMembership && user) {
        const hasMembership = await this.checkUserMembershipStatus(user);
        if (!hasMembership) {
          return {
            ...(await this.cropArticleContent(article, "membership")),
            ...baseResponse,
            isPaid,
          };
        }
      }

      // 检查付费权限
      if (article.requirePayment && user) {
        if (!isPaid) {
          return {
            ...(await this.cropArticleContent(
              article,
              "payment",
              article.viewPrice,
            )),
            ...baseResponse,
            isPaid: false,
          };
        }
      }
    }

    // 有完整权限或无需限制的文章
    return {
      ...article,
      ...baseResponse,
      downloads: article.downloads,
      isPaid,
      imageCount: article.images ? (typeof article.images === "string" ? article.images.split(",").filter(img => img.trim() !== "").length : article.images.length) : 0,
    };
  }

  /**
   * 更新文章
   */
  async update(
    id: number,
    updateArticleDto: UpdateArticleDto,
    currentUser: User,
  ) {
    const { categoryId, tagIds, tagNames, downloads, ...articleData } =
      updateArticleDto;
    const article = await this.articleRepository.findOne({
      where: { id },
      relations: ["category", "tags", "downloads"],
    });
    if (!article) {
      throw new NotFoundException("response.error.articleNotFound");
    }

    // 检查是否是作者
    if (
      currentUser.id !== article.authorId &&
      !PermissionUtil.hasPermission(currentUser, "article:manage")
    ) {
      throw new ForbiddenException("response.error.noPermission");
    }

    // 处理 images 字段：如果是数组则转换为逗号分隔的字符串
    if (articleData.images && Array.isArray(articleData.images)) {
      articleData.images = articleData.images.join(",");
    }

    // 更新分类
    if (categoryId) {
      const category = await this.categoryRepository.findOne({
        where: { id: categoryId },
      });
      if (!category) {
        throw new Error("response.error.categoryNotFound");
      }
      article.category = category;
    }

    // 处理标签更新
    if (tagIds || tagNames) {
      const tags: Tag[] = [];

      // 如果有标签ID，查找现有标签
      if (tagIds && tagIds.length > 0) {
        const existingTags = await this.tagRepository.find({
          where: { id: In(tagIds) },
        });
        tags.push(...existingTags);
      }

      // 如果有标签名称，创建或查找标签
      if (tagNames && tagNames.length > 0) {
        const createdTags = await this.tagService.findOrCreateTags(tagNames);
        // 避免重复添加
        createdTags.forEach((tag) => {
          if (!tags.find((t) => t.id === tag.id)) {
            tags.push(tag);
          }
        });
      }

      article.tags = tags;
    }

    // 更新其他字段
    Object.assign(article, articleData);

    const updatedArticle = await this.articleRepository.save(article);

    // 处理下载资源更新
    if (downloads !== undefined) {
      // 删除现有的下载资源
      await this.downloadRepository.delete({ articleId: id });

      // 创建新的下载资源
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

    // 重新查询文章以包含下载资源和作者装饰品
    const articleWithDownloads = await this.articleRepository.findOne({
      where: { id },
      relations: ["author", "author.userDecorations", "author.userDecorations.decoration", "category", "tags", "downloads"],
    });

    // 处理图片字段
    this.processArticleImages(articleWithDownloads!);

    // 添加imageCount字段
    if (articleWithDownloads) {
      articleWithDownloads['imageCount'] = articleWithDownloads.images ?
        (typeof articleWithDownloads.images === "string" ?
          articleWithDownloads.images.split(",").filter(img => img.trim() !== "").length :
          articleWithDownloads.images.length) : 0;
    }

    return {
      success: true,
      message: "response.success.articleUpdate",
      data: articleWithDownloads,
    };
  }

  /**
   * 删除文章
   */
  async remove(id: number, user: User) {
    // 检查文章是否存在，并加载关联关系
    const article = await this.articleRepository.findOne({
      where: { id },
      relations: ["category", "tags"],
    });
    if (!article) {
      throw new NotFoundException("response.error.articleNotFound");
    }

    // 检查权限：只有作者或管理员可以删除文章
    if (
      article.authorId !== user.id &&
      !PermissionUtil.hasPermission(user, "article:manage")
    ) {
      throw new ForbiddenException("response.error.noPermission");
    }

    // 保存分类和标签ID，用于后续更新计数
    const categoryId = article.category?.id;
    const tagIds = article.tags?.map((tag) => tag.id) || [];

    // 删除文章（级联删除会自动处理相关数据）
    await this.articleRepository.remove(article);

    // 更新分类文章数量
    if (categoryId) {
      this.categoryRepository.decrement({ id: categoryId }, "articleCount", 1);
    }

    // 更新标签文章数量
    tagIds.forEach((tagId) => {
      this.tagRepository.decrement({ id: tagId }, "articleCount", 1);
    });

    // 减少用户发布文章数量
    this.userService.decrementArticleCount(article.authorId);

    return {
      success: true,
      message: "response.success.articleDelete",
    };
  }

  /**
   * 点赞文章或添加表情回复
   */
  async like(articleId: number, user: User, likeDto?: ArticleLikeDto) {
    const article = await this.findOne(articleId);
    if (!article) {
      throw new NotFoundException("response.error.articleNotFound");
    }
    const reactionType = likeDto?.reactionType || "like";

    // 查找是否已有表情回复
    const existingLike = await this.articleLikeRepository.findOne({
      where: {
        articleId,
        userId: user.id,
      },
    });

    if (existingLike) {
      if (existingLike.reactionType === reactionType) {
        // 相同表情，取消
        await this.articleLikeRepository.remove(existingLike);
        // 新增：减少文章点赞数
        this.articleRepository.decrement({ id: articleId }, "likes", 1);

        return {
          success: true,
        };
      } else {
        // 不同表情，更新
        existingLike.reactionType = reactionType;
        await this.articleLikeRepository.save(existingLike);
        return { success: true };
      }
    } else {
      // 新表情回复
      const like = this.articleLikeRepository.create({
        articleId,
        userId: user.id,
        reactionType,
      });
      await this.articleLikeRepository.save(like);
      // 新增：增加文章点赞数
      this.articleRepository.increment({ id: articleId }, "likes", 1);

      // 触发点赞事件（用于装饰品活动进度、积分系统和通知）
      if (reactionType === "like") {
        try {
          this.eventEmitter.emit('article.liked', {
            userId: user.id,
            articleId,
            userName: user.nickname || user.username,
            articleTitle: article.title,
            authorId: article.author?.id,
          });
          // 触发文章被点赞事件（给文章作者积分）
          if (article.author?.id && article.author.id !== user.id) {
            this.eventEmitter.emit('article.receivedLike', {
              authorId: article.author.id,
              articleId,
              likerId: user.id,
            });
          }
        } catch (error) {
          console.error("触发点赞事件失败:", error);
        }
      }

      return { success: true };
    }
  }

  /**
   * 获取文章点赞状态
   */
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

  /**
   * 获取文章点赞数
   */
  async getLikeCount(articleId: number): Promise<number> {
    const count = await this.articleLikeRepository.count({
      where: {
        articleId,
        reactionType: "like",
      },
    });
    return count;
  }

  /**
   * 获取文章踩数
   */
  async getDislikeCount(articleId: number): Promise<number> {
    const count = await this.articleLikeRepository.count({
      where: {
        articleId,
        reactionType: "dislike",
      },
    });
    return count;
  }

  /**
   * 获取文章表情回复统计
   */
  async getReactionStats(
    articleId: number,
  ): Promise<{ [key: string]: number }> {
    const reactions = await this.articleLikeRepository.find({
      where: { articleId },
    });

    const stats = {
      like: 0,
      love: 0,
      haha: 0,
      wow: 0,
      sad: 0,
      angry: 0,
      dislike: 0,
    };

    reactions.forEach((reaction) => {
      stats[reaction.reactionType]++;
    });

    return stats;
  }

  /**
   * 获取用户的表情回复
   */
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

  /**
   * 获取文章所有表情回复
   */
  async getReactions(articleId: number, limit: number = 50): Promise<any[]> {
    return await this.articleLikeRepository.find({
      where: { articleId },
      relations: ["user"],
      order: { createdAt: "DESC" },
      take: limit,
    });
  }

  /**
   * 根据分类查找文章
   */
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

  /**
   * 根据标签查找文章
   */
  async findByTag(tagId: number, pagination: PaginationDto, user?: User) {
    const { page, limit } = pagination;

    const findOptions = {
      where: {
        tags: { id: tagId },
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

  /**
   * 根据作者查找文章
   */
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

    // 基础条件映射器
    const baseConditionMappers = [
      // 非管理员只查询已发布文章
      () => !hasPermission && { status: "PUBLISHED" },
      // 根据分类ID查询
      () => categoryId && { category: { id: categoryId } },
      // 根据关键词查询
      () =>
        keyword && {
          title: Like(`%${keyword}%`),
          content: Like(`%${keyword}%`),
          tags: {
            name: Like(`%${keyword}%`),
          },
        },

      // 根据作者ID查询
      () => ({ author: { id: authorId } }),
    ];

    // 合并基础条件
    const baseWhereCondition = baseConditionMappers
      .map((mapper) => mapper())
      .filter(Boolean)
      .reduce((acc, curr) => ({ ...acc, ...curr }), {});

    const { page, limit } = pagination;

    let findOptions: FindManyOptions<Article>;

    // 根据type类型构建不同的查询条件
    switch (type) {
      case "popular":
        // 热门文章（按浏览量排序）
        // 如果一周内没有文章，则不限制时间范围
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        // 先尝试查询一周内的文章
        findOptions = {
          where: {
            ...baseWhereCondition,
            createdAt: MoreThan(oneWeekAgo),
          },
          relations: ["author", "category", "tags", "downloads"],
          order: {
            sort: "DESC" as const,
            views: "DESC",
            createdAt: "DESC" as const,
          },
          skip: (page - 1) * limit,
          take: limit,
        };

        // 检查一周内是否有文章，如果没有则不限制时间范围
        const popularTotal = await this.articleRepository.count(findOptions);

        if (popularTotal === 0) {
          // 如果一周内没有文章，则查询所有文章
          findOptions = {
            where: baseWhereCondition,
            relations: ["author", "category", "tags", "downloads"],
            order: {
              sort: "DESC" as const,
              views: "DESC",
              createdAt: "DESC" as const,
            },
            skip: (page - 1) * limit,
            take: limit,
          };
        }

        break;

      case "latest":
        // 最新文章
        findOptions = {
          where: baseWhereCondition,
          relations: ["author", "category", "tags", "downloads"],
          order: {
            sort: "DESC" as const,
            createdAt: "DESC" as const,
          },
          skip: (page - 1) * limit,
          take: limit,
        };
        break;

      default:
        // all 或未指定type时使用默认查询
        findOptions = {
          where: baseWhereCondition,
          relations: ["author", "category", "tags", "downloads"],
          order: {
            sort: "DESC" as const,
            createdAt: "DESC" as const,
          },
          skip: (page - 1) * limit,
          take: limit,
        };
        break;
    }

    const [data, total] =
      await this.articleRepository.findAndCount(findOptions);

    return this.processArticleResults(data, total, page, limit, user);
  }

  /**
   * 搜索文章
   */
  async searchArticles(
    keyword: string,
    pagination: PaginationDto,
    categoryId?: number,
    user?: User,
  ) {
    const { page, limit } = pagination;

    // 检查用户是否有文章管理权限
    const hasPermission =
      user && PermissionUtil.hasPermission(user, "article:manage");

    // 根据权限决定状态条件
    const statusCondition = hasPermission
      ? {}
      : { status: "PUBLISHED" as const };

    // 构建搜索条件数组
    const searchConditions: FindOptionsWhere<Article>[] = [
      { title: Like(`%${keyword}%`), ...statusCondition },
      { content: Like(`%${keyword}%`), ...statusCondition },
      { summary: Like(`%${keyword}%`), ...statusCondition },
      { tags: { name: Like(`%${keyword}%`) }, ...statusCondition },
      { category: { name: Like(`%${keyword}%`) }, ...statusCondition },
      { author: { username: Like(`%${keyword}%`) }, ...statusCondition },
    ];

    // 如果提供了分类ID，添加分类条件
    if (categoryId) {
      searchConditions.push({
        category: { id: categoryId },
        ...statusCondition,
      });
    }

    const findOptions = {
      where: searchConditions,
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

  /**
   * 获取相关推荐
   */
  async findRelatedRecommendations(articleId: number, currentUser?: User) {
    // 首先检查文章是否存在以及用户是否有权限查看
    const article = await this.articleRepository.findOne({
      where: { id: articleId },
      relations: ["category", "tags", "author", "downloads"],
    });

    if (!article) {
      // 如果文章不存在，直接返回空数组
      return ListUtil.buildPaginatedList([], 0, 1, 5);
    }

    // 检查权限：如果文章不是已发布状态且用户没有管理权限，则抛出异常
    const hasPermission =
      currentUser &&
      PermissionUtil.hasPermission(currentUser, "article:manage");
    const isAuthor = currentUser && currentUser.id === article.authorId;

    if (article.status !== "PUBLISHED" && !hasPermission && !isAuthor) {
      // 如果文章不是已发布状态且用户没有权限，直接返回空数组
      return ListUtil.buildPaginatedList([], 0, 1, 5);
    }

    // 继续原有的相关推荐逻辑
    const { category, tags } = article;

    // 确保 category.id 和 tag.id 是有效的数字
    const categoryId = category?.id;
    const tagIds = tags
      ?.map((tag) => tag.id)
      .filter((id) => id && !isNaN(Number(id)));

    // 如果没有有效的分类或标签，返回空数组
    if (
      (!categoryId || isNaN(Number(categoryId))) &&
      (!tagIds || tagIds.length === 0)
    ) {
      return ListUtil.buildPaginatedList([], 0, 1, 5);
    }

    const whereConditions: FindOptionsWhere<Article> = {
      ...(hasPermission ? {} : { status: "PUBLISHED" }),
      ...(categoryId &&
        !isNaN(Number(categoryId)) && { category: { id: categoryId } }),
      ...(tagIds && tagIds.length > 0 && { tags: { id: In(tagIds) } }),
    };

    // 只有在有有效查询条件时才执行查询
    let relatedArticles: Article[] = [];
    if (Object.keys(whereConditions).length > 0) {
      // 获取相关文章，按创建时间排序，优先最新文章
      const allRelatedArticles = await this.articleRepository.find({
        where: whereConditions,
        relations: ["author", "category", "tags", "downloads"],
        order: {
          createdAt: "DESC", // 优先最新文章
        },
        take: 30, // 获取更多文章用于智能选择
      });

      // 过滤掉当前文章
      const availableArticles = allRelatedArticles.filter(
        (article) => article.id !== articleId,
      );

      // 智能选择文章：结合最新性和随机性
      if (availableArticles.length > 5) {
        // 将文章分为最新组和其他组
        const latestArticles = availableArticles.slice(
          0,
          Math.ceil(availableArticles.length * 0.6),
        ); // 60% 最新文章
        const otherArticles = availableArticles.slice(
          Math.ceil(availableArticles.length * 0.6),
        );

        // 从最新文章中随机选择3篇
        const selectedLatest = this.shuffleArray(latestArticles).slice(0, 3);

        // 从其他文章中随机选择2篇
        const selectedOthers = this.shuffleArray(otherArticles).slice(0, 2);

        // 合并并再次随机排序最终结果
        relatedArticles = this.shuffleArray([
          ...selectedLatest,
          ...selectedOthers,
        ]);
      } else {
        relatedArticles = availableArticles;
      }

      // 如果相关文章不够5篇，补充一些最新和热门文章
      if (relatedArticles.length < 5) {
        const remainingCount = 5 - relatedArticles.length;
        const existingIds = relatedArticles.map((article) => article.id);

        // 优先获取最新文章作为补充
        const latestArticles = await this.articleRepository.find({
          where: {
            ...(hasPermission ? {} : { status: "PUBLISHED" }),
            id: Not(In([...existingIds, articleId])),
          },
          relations: ["author", "category", "tags", "downloads"],
          order: {
            createdAt: "DESC", // 优先最新文章
          },
          take: remainingCount * 3, // 获取更多用于选择
        });

        // 如果最新文章不够，再获取热门文章
        if (latestArticles.length < remainingCount) {
          const popularArticles = await this.articleRepository.find({
            where: {
              ...(hasPermission ? {} : { status: "PUBLISHED" }),
              id: Not(
                In([
                  ...existingIds,
                  articleId,
                  ...latestArticles.map((a) => a.id),
                ]),
              ),
            },
            relations: ["author", "category", "tags", "downloads"],
            order: {
              views: "DESC",
              createdAt: "DESC",
            },
            take: (remainingCount - latestArticles.length) * 2,
          });

          // 合并最新文章和热门文章
          const allSupplementArticles = [...latestArticles, ...popularArticles];
          const shuffledSupplement = this.shuffleArray(allSupplementArticles);
          relatedArticles = [
            ...relatedArticles,
            ...shuffledSupplement.slice(0, remainingCount),
          ];
        } else {
          // 从最新文章中随机选择
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
      currentUser, // 传递currentUser参数
    );
  }

  /**
   * 增加文章阅读量
   */
  async incrementViews(id: number) {
    const article = await this.articleRepository.findOne({ where: { id } });
    if (!article) {
      throw new NotFoundException("response.error.articleNotFound");
    }
    return await this.articleRepository.increment({ id: id }, "views", 1);
  }

  /**
   * 发布文章
   */
  async publishArticle(id: number) {
    return await this.articleRepository.update(id, { status: "PUBLISHED" });
  }

  /**
   * 取消发布文章
   */
  async unpublishArticle(id: number) {
    return await this.articleRepository.update(id, { status: "DRAFT" });
  }

  /**
   * 检查用户是否关注了作者
   */
  private async checkUserFollowStatus(
    userId: number,
    authorId: number,
  ): Promise<boolean> {
    try {
      return await this.userService.isFollowing(userId, authorId);
    } catch (error) {
      console.error("检查关注关系失败:", error);
      return false;
    }
  }

  /**
   * 检查用户是否已支付文章费用
   */
  private async checkUserPaymentStatus(userId: number, articleId: number) {
    try {
      return await this.orderService.hasPaidForArticle(userId, articleId);
    } catch (error) {
      console.error("检查支付状态失败:", error);
      return false;
    }
  }

  /**
   * 检查用户会员状态
   */
  private async checkUserMembershipStatus(user: User) {
    try {
      return (
        user.membershipStatus === "ACTIVE" &&
        user.membershipLevel > 0 &&
        (user.membershipEndDate === null || user.membershipEndDate > new Date())
      );
    } catch (error) {
      console.error("检查会员状态失败:", error);
      return false;
    }
  }

  /**
   * 为作者添加完整状态信息（会员状态和关注状态）
   */
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

  /**
   * 使用 Fisher-Yates 算法随机打乱数组
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * 获取已发布文章的ID列表
   */
  async getPublishedArticleIds() {
    const articles = await this.articleRepository.find({
      where: { status: "PUBLISHED" },
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
          "article.category",
          "article.tags",
        ],
      });

    // 处理文章
    return this.processArticleResults(
      likedArticles.map((like) => like.article),
      total,
      pagination.page,
      pagination.limit,
      user,
    );
  }

  /**
   * 记录浏览历史
   */
  async recordBrowseHistory(
    userId: number,
    articleId: number,
    recordDto?: RecordBrowseHistoryDto,
  ) {
    // 检查文章是否存在
    const article = await this.articleRepository.findOne({
      where: { id: articleId },
    });

    if (!article) {
      throw new NotFoundException('response.error.articleNotFound');
    }

    // 查找是否已有浏览记录
    let browseHistory = await this.browseHistoryRepository.findOne({
      where: { userId, articleId },
    });

    if (browseHistory) {
      // 更新现有记录
      browseHistory.viewCount += 1;
      if (recordDto?.progress !== undefined) {
        browseHistory.progress = Math.max(browseHistory.progress, recordDto.progress);
      }
      if (recordDto?.duration !== undefined) {
        browseHistory.duration += recordDto.duration;
      }
      browseHistory.updatedAt = new Date();
    } else {
      // 创建新记录
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
      message: 'response.success.browseHistoryRecorded',
      data: browseHistory,
    };
  }

  /**
   * 更新浏览进度
   */
  async updateBrowseProgress(
    userId: number,
    articleId: number,
    recordDto: RecordBrowseHistoryDto,
  ) {
    const browseHistory = await this.browseHistoryRepository.findOne({
      where: { userId, articleId },
    });

    if (!browseHistory) {
      // 如果没有记录，创建一个
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
      message: 'response.success.browseHistoryUpdated',
      data: browseHistory,
    };
  }

  /**
   * 获取用户浏览历史列表
   */
  async getUserBrowseHistory(userId: number, queryDto: QueryBrowseHistoryDto) {
    const { page, limit, startDate, endDate, categoryId } = queryDto;

    const queryBuilder = this.browseHistoryRepository
      .createQueryBuilder('browseHistory')
      .leftJoinAndSelect('browseHistory.article', 'article')
      .leftJoinAndSelect('article.author', 'author')
      .leftJoinAndSelect('author.userDecorations', 'userDecorations')
      .leftJoinAndSelect('userDecorations.decoration', 'decoration')
      .leftJoinAndSelect('article.category', 'category')
      .leftJoinAndSelect('article.tags', 'tags')
      .where('browseHistory.userId = :userId', { userId })
      .andWhere('article.status = :status', { status: 'PUBLISHED' });

    // 日期筛选
    if (startDate && endDate) {
      queryBuilder.andWhere('browseHistory.updatedAt BETWEEN :startDate AND :endDate', {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      });
    } else if (startDate) {
      queryBuilder.andWhere('browseHistory.updatedAt >= :startDate', {
        startDate: new Date(startDate),
      });
    } else if (endDate) {
      queryBuilder.andWhere('browseHistory.updatedAt <= :endDate', {
        endDate: new Date(endDate),
      });
    }

    // 分类筛选
    if (categoryId) {
      queryBuilder.andWhere('article.categoryId = :categoryId', { categoryId });
    }

    // 排序和分页
    queryBuilder
      .orderBy('browseHistory.updatedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [histories, total] = await queryBuilder.getManyAndCount();

    // 处理数据
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

  /**
   * 获取单条浏览记录
   */
  async getBrowseHistory(userId: number, articleId: number) {
    const browseHistory = await this.browseHistoryRepository.findOne({
      where: { userId, articleId },
      relations: ['article', 'article.author', 'article.author.userDecorations', 'article.author.userDecorations.decoration', 'article.category', 'article.tags'],
    });

    if (!browseHistory) {
      return null;
    }

    return {
      ...browseHistory,
      article: browseHistory.article ? {
        ...browseHistory.article,
        author: browseHistory.article.author
          ? sanitizeUser(processUserDecorations(browseHistory.article.author))
          : null,
      } : null,
    };
  }

  /**
   * 删除单条浏览记录
   */
  async deleteBrowseHistory(userId: number, articleId: number) {
    const browseHistory = await this.browseHistoryRepository.findOne({
      where: { userId, articleId },
    });

    if (!browseHistory) {
      throw new NotFoundException('response.error.browseHistoryNotFound');
    }

    await this.browseHistoryRepository.remove(browseHistory);

    return {
      success: true,
      message: 'response.success.browseHistoryDeleted',
    };
  }

  /**
   * 批量删除浏览记录
   */
  async batchDeleteBrowseHistory(userId: number, articleIds: number[]) {
    await this.browseHistoryRepository.delete({
      userId,
      articleId: In(articleIds),
    });

    return {
      success: true,
      message: 'response.success.browseHistoryBatchDeleted',
    };
  }

  /**
   * 清空用户浏览历史
   */
  async clearBrowseHistory(userId: number) {
    await this.browseHistoryRepository.delete({ userId });

    return {
      success: true,
      message: 'response.success.browseHistoryCleared',
    };
  }

  /**
   * 获取浏览统计
   */
  async getBrowseStats(userId: number) {
    const queryBuilder = this.browseHistoryRepository
      .createQueryBuilder('browseHistory')
      .where('browseHistory.userId = :userId', { userId });

    // 总浏览记录数
    const totalCount = await queryBuilder.getCount();

    // 总浏览次数
    const totalViewsResult = await queryBuilder
      .select('SUM(browseHistory.viewCount)', 'total')
      .getRawOne();
    const totalViews = parseInt(totalViewsResult?.total || '0');

    // 总停留时长
    const totalDurationResult = await queryBuilder
      .select('SUM(browseHistory.duration)', 'total')
      .getRawOne();
    const totalDuration = parseInt(totalDurationResult?.total || '0');

    // 今日浏览
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = await this.browseHistoryRepository.count({
      where: {
        userId,
        updatedAt: MoreThanOrEqual(today),
      },
    });

    // 本周浏览
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    weekAgo.setHours(0, 0, 0, 0);
    const weekCount = await this.browseHistoryRepository.count({
      where: {
        userId,
        updatedAt: MoreThanOrEqual(weekAgo),
      },
    });

    // 本月浏览
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

  /**
   * 获取最近浏览的文章
   */
  async getRecentBrowsedArticles(userId: number, limit: number = 10) {
    const histories = await this.browseHistoryRepository.find({
      where: { userId },
      relations: [
        'article',
        'article.author',
        'article.author.userDecorations',
        'article.author.userDecorations.decoration',
        'article.category',
        'article.tags',
      ],
      order: { updatedAt: 'DESC' },
      take: limit,
    });

    return histories
      .filter((h) => h.article && h.article.status === 'PUBLISHED')
      .map((history) => ({
        ...history.article,
        author: history.article.author
          ? sanitizeUser(processUserDecorations(history.article.author))
          : null,
        lastBrowsedAt: history.updatedAt,
        browseProgress: history.progress,
      }));
  }
}
