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
  MoreThan,
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
import { PaginationDto } from "src/common/dto/pagination.dto";
import { PermissionUtil, sanitizeUser } from "src/common/utils";
import { TagService } from "../tag/tag.service";
import { UserService } from "../user/user.service";
import { OrderService } from "../order/order.service";
import { ListUtil } from "src/common/utils";
import { ArticleLikeDto } from "./dto/article-reaction.dto";
import { ConfigService } from "../config/config.service";

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
    private tagService: TagService,
    private userService: UserService,
    private orderService: OrderService,
    private configService: ConfigService,
  ) {}

  /**
   * 创建文章
   */
  async createArticle(createArticleDto: CreateArticleDto, author: User) {
    const { categoryId, tagIds, tagNames, status, sort, ...articleData } =
      createArticleDto;
    const hasPermission = PermissionUtil.hasPermission(
      author,
      "article:manage",
    );
    // 查找分类
    const category = await this.categoryRepository.findOne({
      where: { id: categoryId },
    });
    if (!category) {
      throw new Error("response.error.categoryNotFound");
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
      article.status = "PUBLISHED";
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
    return await this.articleRepository.save(article);
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
          relations: ["author", "category", "tags"],
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
            relations: ["author", "category", "tags"],
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
          relations: ["author", "category", "tags"],
          order: {
            sort: "DESC" as const,
            createdAt: "DESC" as const,
          },
          skip: (page - 1) * limit,
          take: limit,
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
          relations: ["author", "category", "tags"],
          order: {
            // 先按排序，然后按最新优先，最后按热度
            sort: "DESC" as const,
            createdAt: "DESC" as const,
            views: "DESC" as const,
          },
          skip: (page - 1) * limit,
          take: limit,
        };
        break;

      default:
        // all 或未指定type时使用默认查询
        findOptions = {
          where: baseWhereCondition,
          relations: ["author", "category", "tags"],
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

        // 添加作者的 isFollowed 字段
        if (user && article.author) {
          const isFollowed = await this.userService.isFollowing(
            user.id,
            article.author.id,
          );
          processedArticle.author = {
            ...processedArticle.author,
            isFollowed,
          };
        } else if (article.author) {
          processedArticle.author = {
            ...processedArticle.author,
            isFollowed: false,
          };
        }

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
      relations: ["author", "category", "tags"],
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

    // 处理图片字段
    this.processArticleImages(article);

    // 使用通用方法处理权限和内容裁剪
    const processedArticle = await this.processArticlePermissions(
      article,
      currentUser,
      isLiked,
    );

    // 添加作者的 isFollowed 字段
    if (currentUser && article.author) {
      const isFollowed = await this.userService.isFollowing(
        currentUser.id,
        article.author.id,
      );
      processedArticle.author = {
        ...processedArticle.author,
        isFollowed,
      };
    } else if (article.author) {
      processedArticle.author = {
        ...processedArticle.author,
        isFollowed: false,
      };
    }

    return processedArticle;
  }

  /**
   * 处理文章图片字段
   */
  private processArticleImages(article: Article): void {
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
   */
  private cropArticleContent(
    article: Article,
    restrictionType: string,
    price?: number,
  ): Article {
    // 处理图片，保留前3张
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

      previewImages = imageArray.slice(0, 3);
    }

    // 保留基础信息，裁剪内容
    const croppedArticle = {
      ...article,
      content: this.generateRestrictedContent(restrictionType, price),
      images: previewImages as any, // 保留前3张图片
    };

    return croppedArticle;
  }

  /**
   * 处理文章权限和内容裁剪（通用方法）
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

    // 如果没有完整权限，进行内容裁剪
    if (!hasFullAccess) {
      // 检查登录权限 - 如果设置了登录权限但用户未登录，直接返回裁剪内容
      if (article.requireLogin && !user) {
        return {
          ...this.cropArticleContent(article, "login"),
          isLiked,
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
          ...this.cropArticleContent(article, "login"),
          isLiked,
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
            ...this.cropArticleContent(article, "follow"),
            isLiked,
            isPaid,
          };
        }
      }

      // 检查会员权限
      if (article.requireMembership && user) {
        const hasMembership = await this.checkUserMembershipStatus(user);
        if (!hasMembership) {
          return {
            ...this.cropArticleContent(article, "membership"),
            isLiked,
            isPaid,
          };
        }
      }

      // 检查付费权限
      if (article.requirePayment && user) {
        if (!isPaid) {
          return {
            ...this.cropArticleContent(article, "payment", article.viewPrice),
            isLiked,
            isPaid: false,
          };
        }
      }
    }

    // 有完整权限或无需限制的文章
    return {
      ...article,
      author: sanitizeUser(article.author),
      isLiked,
      isPaid,
    };
  }

  /**
   * 生成受限内容提示（国际化版本）
   */
  private generateRestrictedContent(type: string, price?: number): string {
    switch (type) {
      case "login":
        return "article.loginRequired";
      case "follow":
        return "article.followRequired";
      case "membership":
        return "article.membershipRequired";
      case "payment":
        return `article.paymentRequired:${price}`;
      default:
        return "article.contentRestricted";
    }
  }

  /**
   * 更新文章
   */
  async update(
    id: number,
    updateArticleDto: UpdateArticleDto,
    currentUser: User,
  ): Promise<Article> {
    const { categoryId, tagIds, tagNames, ...articleData } = updateArticleDto;
    const article = await this.articleRepository.findOne({
      where: { id },
      relations: ["category", "tags"],
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

    return await this.articleRepository.save(article);
  }

  /**
   * 删除文章
   */
  async remove(id: number, user: User) {
    // 检查是否是作者
    const article = await this.findOne(id);
    if (
      article.authorId !== user.id &&
      !PermissionUtil.hasPermission(user, "article:manage")
    ) {
      throw new ForbiddenException("response.error.noPermission");
    }
    await this.articleRepository.remove(article);
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
      relations: ["author", "category", "tags"],
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
      relations: ["author", "category", "tags"],
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
      user && PermissionUtil.hasPermission(user, "article:manage");

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
          relations: ["author", "category", "tags"],
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
            relations: ["author", "category", "tags"],
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
          relations: ["author", "category", "tags"],
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
          relations: ["author", "category", "tags"],
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
      relations: ["author", "category", "tags"],
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
      relations: ["category", "tags", "author"],
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
      relatedArticles = await this.articleRepository.find({
        where: whereConditions,
        relations: ["author", "category", "tags"],
        order: {
          sort: "DESC" as const,
          views: "DESC",
        },
        take: 5,
      });
    }
    // 过滤掉当前文章
    const filteredArticles = relatedArticles.filter(
      (article) => article.id !== articleId,
    );
    return this.processArticleResults(
      filteredArticles,
      filteredArticles.length,
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
  private async checkUserPaymentStatus(
    userId: number,
    articleId: number,
  ): Promise<boolean> {
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
  private async checkUserMembershipStatus(user: User): Promise<boolean> {
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
}
