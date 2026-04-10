import { Injectable, Inject, forwardRef } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { Article } from "./entities/article.entity";
import { ArticleLike } from "./entities/article-like.entity";
import { ArticleFavorite } from "./entities/article-favorite.entity";
import { ArticleService } from "./article.service";
import { User } from "../user/entities/user.entity";
import { Category } from "../category/entities/category.entity";
import { Upload } from "../upload/entities/upload.entity";
import { DecorationActivity } from "../decoration/entities/decoration-activity.entity";
import { ConfigService } from "../config/config.service";
import { UserService } from "../user/user.service";
import { OrderService } from "../order/order.service";
import {
  ListUtil,
  PermissionUtil,
  sanitizeUser,
  processUserDecorations,
  ImageSerializer,
} from "../../common/utils";

type ArticleBatchContext = {
  followedAuthorIds: Set<number>;
  blockedAuthorIds: Set<number>;
  paidArticleIds: Set<number>;
  parentCategoryMap: Map<number, Category>;
  freeImagesCount: number;
  activityMap: Map<number, DecorationActivity>;
};

@Injectable()
export class ArticlePresentationService {
  constructor(
    @InjectRepository(ArticleLike)
    private articleLikeRepository: Repository<ArticleLike>,
    @InjectRepository(ArticleFavorite)
    private articleFavoriteRepository: Repository<ArticleFavorite>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    @InjectRepository(Upload)
    private uploadRepository: Repository<Upload>,
    @InjectRepository(DecorationActivity)
    private activityRepository: Repository<DecorationActivity>,
    private configService: ConfigService,
    @Inject(forwardRef(() => UserService))
    private userService: UserService,
    private orderService: OrderService,
  ) {}

  private attachHotArticleMeta(article: any) {
    const hotScore = ArticleService.calculateHotScore(article);
    article.hotScore = hotScore;
    article.isHot = ArticleService.isHotArticle({
      createdAt: article.createdAt,
      hotScore,
    });
  }

  async prepareArticleList(
    data: Article[],
    total: number,
    page: number,
    limit: number,
    user?: User,
  ) {
    const articleIds = data.map((article) => article.id);
    const batchContext = await this.buildArticleBatchContext(data, user);

    for (const article of data) {
      this.attachParentCategory(article, batchContext.parentCategoryMap);
      this.attachActivity(article, batchContext.activityMap);
      this.attachHotArticleMeta(article);
      await this.processArticleImages(article);
      this.fillArticleSummaryFromContent(article);
    }

    let userLikedArticleIds: Set<number> = new Set();
    const userReactionMap: Map<number, string> = new Map();
    let userFavoritedArticleIds: Set<number> = new Set();

    if (user && articleIds.length > 0) {
      const userLikes = await this.articleLikeRepository.find({
        where: {
          user: { id: user.id },
          article: { id: In(articleIds) },
        },
        relations: ["article"],
      });

      userLikedArticleIds = new Set(
        userLikes.filter((like) => like.article).map((like) => like.article.id),
      );

      userLikes
        .filter((like) => like.article)
        .forEach((like) => {
          userReactionMap.set(like.article.id, like.reactionType);
        });

      const userFavorites = await this.articleFavoriteRepository.find({
        where: {
          userId: user.id,
          articleId: In(articleIds),
        },
      });

      userFavoritedArticleIds = new Set(
        userFavorites.map((favorite) => favorite.articleId),
      );
    }

    const reactionStatsMap = await this.getBatchReactionStats(articleIds);

    const processedArticles = await Promise.all(
      data.map(async (article) => {
        const processedArticle = await this.processArticlePermissions(
          article,
          user,
          userLikedArticleIds.has(article.id),
          batchContext,
        );

        const reactionStats =
          reactionStatsMap.get(article.id) || this.buildEmptyReactionStats();
        (processedArticle as any).reactionStats = reactionStats;
        (processedArticle as any).likes =
          this.getTotalReactionCount(reactionStats);
        (processedArticle as any).userReaction =
          user && userReactionMap.has(article.id)
            ? userReactionMap.get(article.id)
            : null;
        (processedArticle as any).isFavorited = userFavoritedArticleIds.has(
          article.id,
        );

        if (processedArticle.author && article.author) {
          processedArticle.author = {
            ...processUserDecorations(processedArticle.author),
            isMember: this.checkUserMembershipStatus(article.author),
            isFollowed: user
              ? batchContext.followedAuthorIds.has(article.author.id)
              : false,
            isBlocked: user
              ? batchContext.blockedAuthorIds.has(article.author.id)
              : false,
          };
        }

        return processedArticle;
      }),
    );

    return ListUtil.buildPaginatedList(processedArticles, total, page, limit);
  }

  async prepareArticle(article: Article, currentUser?: User) {
    const batchContext = await this.buildArticleBatchContext(
      [article],
      currentUser,
    );
    this.attachParentCategory(article, batchContext.parentCategoryMap);
    this.attachActivity(article, batchContext.activityMap);
    this.attachHotArticleMeta(article);
    await this.processArticleImages(article);
    this.fillArticleSummaryFromContent(article);

    let userLike: ArticleLike | null = null;
    if (currentUser) {
      userLike = await this.articleLikeRepository.findOne({
        where: {
          user: { id: currentUser.id },
          article: { id: article.id },
        },
      });
    }

    const processedArticle = await this.processArticlePermissions(
      article,
      currentUser,
      !!userLike,
      batchContext,
    );

    const reactionStats = await this.getReactionStats(article.id);
    (processedArticle as any).reactionStats = reactionStats;
    (processedArticle as any).likes = this.getTotalReactionCount(reactionStats);
    (processedArticle as any).userReaction = userLike?.reactionType || null;
    (processedArticle as any).isFavorited = currentUser
      ? !!(await this.articleFavoriteRepository.findOne({
          where: { userId: currentUser.id, articleId: article.id },
        }))
      : false;

    if (processedArticle.author && article.author) {
      processedArticle.author = {
        ...processUserDecorations(processedArticle.author),
        isMember: this.checkUserMembershipStatus(article.author),
        isFollowed: currentUser
          ? batchContext.followedAuthorIds.has(article.author.id)
          : false,
        isBlocked: currentUser
          ? batchContext.blockedAuthorIds.has(article.author.id)
          : false,
      };
    }

    return processedArticle;
  }

  async prepareBasicArticle(article: Article) {
    const batchContext = await this.buildArticleBatchContext([article]);
    this.attachParentCategory(article, batchContext.parentCategoryMap);
    this.attachActivity(article, batchContext.activityMap);
    this.attachHotArticleMeta(article);
    await this.processArticleImages(article);
    this.fillArticleSummaryFromContent(article);

    if (article.author) {
      article.author = sanitizeUser(processUserDecorations(article.author));
    }

    return {
      ...article,
      imageCount: Array.isArray(article.images) ? article.images.length : 0,
      downloadCount: article.downloads ? article.downloads.length : 0,
    };
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

    const stats = this.buildEmptyReactionStats();
    result.forEach((row) => {
      stats[row.reactionType] = parseInt(row.count, 10);
    });

    return stats;
  }

  private async getBatchReactionStats(
    articleIds: number[],
  ): Promise<Map<number, { [key: string]: number }>> {
    if (articleIds.length === 0) {
      return new Map();
    }

    const result = await this.articleLikeRepository
      .createQueryBuilder("articleLike")
      .select("articleLike.articleId", "articleId")
      .addSelect("articleLike.reactionType", "reactionType")
      .addSelect("COUNT(*)", "count")
      .where("articleLike.articleId IN (:...articleIds)", { articleIds })
      .groupBy("articleLike.articleId, articleLike.reactionType")
      .getRawMany();

    const statsMap = new Map<number, { [key: string]: number }>();
    articleIds.forEach((articleId) => {
      statsMap.set(articleId, this.buildEmptyReactionStats());
    });

    result.forEach((row) => {
      const articleId = parseInt(row.articleId, 10);
      const stats = statsMap.get(articleId);
      if (stats) {
        stats[row.reactionType] = parseInt(row.count, 10);
      }
    });

    return statsMap;
  }

  private buildEmptyReactionStats() {
    return {
      like: 0,
      love: 0,
      haha: 0,
      wow: 0,
      sad: 0,
      angry: 0,
      dislike: 0,
    };
  }

  private getTotalReactionCount(stats: { [key: string]: number }): number {
    return Object.values(stats).reduce((total, count) => total + count, 0);
  }

  private async buildArticleBatchContext(
    articles: Article[],
    user?: User,
  ): Promise<ArticleBatchContext> {
    const parentCategoryIds = Array.from(
      new Set(
        articles
          .map((article) => article.category?.parentId)
          .filter(
            (categoryId): categoryId is number =>
              typeof categoryId === "number",
          ),
      ),
    );
    const authorIds = Array.from(
      new Set(
        articles
          .map((article) => article.author?.id)
          .filter(
            (authorId): authorId is number => typeof authorId === "number",
          ),
      ),
    );
    const payableArticleIds = articles
      .filter((article) => article.requirePayment)
      .map((article) => article.id);
    const needsFreeImageCount = articles.some((article) =>
      this.articleNeedsRestrictedPreview(article, user),
    );

    const activityIds = Array.from(
      new Set(
        articles
          .map((article) => article.activityId)
          .filter(
            (activityId): activityId is number =>
              typeof activityId === "number" && activityId > 0,
          ),
      ),
    );

    const [
      parentCategories,
      followedAuthorIds,
      blockedAuthorIds,
      paidArticleIds,
      freeImagesCount,
      activities,
    ] = await Promise.all([
      parentCategoryIds.length > 0
        ? this.categoryRepository.find({
            where: { id: In(parentCategoryIds) },
          })
        : Promise.resolve([]),
      user && authorIds.length > 0
        ? this.userService.getFollowedUserIdSet(user.id, authorIds)
        : Promise.resolve(new Set<number>()),
      user && authorIds.length > 0
        ? this.userService.getBlockedUserIdSet(user.id, authorIds)
        : Promise.resolve(new Set<number>()),
      user && payableArticleIds.length > 0
        ? this.orderService.getPaidArticleIdSet(user.id, payableArticleIds)
        : Promise.resolve(new Set<number>()),
      needsFreeImageCount
        ? this.configService.getArticleFreeImagesCount()
        : Promise.resolve(3),
      activityIds.length > 0
        ? this.activityRepository.find({
            where: { id: In(activityIds) },
            relations: ["decoration"],
          })
        : Promise.resolve([]),
    ]);

    return {
      followedAuthorIds,
      blockedAuthorIds,
      paidArticleIds,
      parentCategoryMap: new Map(
        parentCategories.map((category) => [category.id, category]),
      ),
      freeImagesCount,
      activityMap: new Map(
        activities.map((activity) => [activity.id, activity]),
      ),
    };
  }

  private articleNeedsRestrictedPreview(article: Article, user?: User) {
    const isAuthor = !!user && user.id === article.author.id;
    const isAdmin =
      !!user && PermissionUtil.hasPermission(user, "article:manage");
    const hasFullAccess = isAuthor || isAdmin;

    return (
      !hasFullAccess &&
      (!!article.requireLogin ||
        !!article.requireFollow ||
        !!article.requireMembership ||
        !!article.requirePayment)
    );
  }

  private attachParentCategory(
    article: Article,
    parentCategoryMap: Map<number, Category>,
  ) {
    if (
      article.category?.parentId &&
      article.category.parentId !== article.category.id
    ) {
      const parentCategory = parentCategoryMap.get(article.category.parentId);
      if (parentCategory) {
        article.category.parent = parentCategory;
      }
    }
  }

  private attachActivity(
    article: Article,
    activityMap: Map<number, DecorationActivity>,
  ) {
    if (article.activityId) {
      const activity = activityMap.get(article.activityId);
      if (activity) {
        article.activity = activity;
      }
    }
  }

  private async processArticleImages(article: Article) {
    // 先提取所有图片 URL
    const imageUrls = ImageSerializer.extractUrls(article.images as any);

    // 查询 Upload 表获取完整信息
    let uploads: Upload[] = [];
    if (imageUrls.length > 0) {
      uploads = await this.uploadRepository.find({
        where: { url: In(imageUrls) },
      });
    }

    // 使用 Upload 信息构建 ImageObject 数组
    if (imageUrls.length > 0) {
      article.images = ImageSerializer.processImagesWithUploads(
        imageUrls,
        uploads,
      ) as any;
    } else {
      article.images = [] as any;
    }

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

  private async cropArticleContent(
    article: Article,
    restrictionType: string,
    price?: number,
    freeImagesCount: number = 3,
  ) {
    let previewImages: string[] = [];

    if (article.images) {
      let imageArray: string[] = [];
      if (typeof article.images === "string") {
        imageArray = article.images
          .split(",")
          .filter((img: string) => img.trim() !== "");
      } else if (Array.isArray(article.images)) {
        // 处理 ImageObject 数组，提取 url
        imageArray = article.images
          .filter(
            (img: any) =>
              img && (typeof img === "string" ? img.trim() !== "" : img.url),
          )
          .map((img: any) => (typeof img === "string" ? img : img.url));
      }

      previewImages = imageArray.slice(0, freeImagesCount);
    }

    if (article.type === "mixed") {
      const visibleDownloads =
        article.downloads?.filter((d) => d.visibleWithoutPermission) || [];
      return {
        ...article,
        downloads: visibleDownloads,
        imageCount: article.images.length || 0,
        downloadCount: article.downloads ? article.downloads.length : 0,
      };
    }

    const visibleDownloads =
      article.downloads?.filter((d) => d.visibleWithoutPermission) || [];
    return {
      ...article,
      images: previewImages as any,
      imageCount: article.images.length || 0,
      downloads: visibleDownloads,
      downloadCount: article.downloads ? article.downloads.length : 0,
    };
  }

  private getBaseResponse(author: User, isLiked: boolean, downloads: any[]) {
    const visibleDownloads =
      downloads?.filter((d) => d.visibleWithoutPermission) || [];
    return {
      author: sanitizeUser(processUserDecorations(author)),
      downloads: visibleDownloads,
      downloadCount: downloads ? downloads.length : 0,
      isLiked,
    };
  }

  private async processArticlePermissions(
    article: Article,
    user?: User,
    isLiked: boolean = false,
    batchContext?: ArticleBatchContext,
  ) {
    const isAuthor = user && user.id === article.author.id;
    const isAdmin =
      user && PermissionUtil.hasPermission(user, "article:manage");
    const hasFullAccess = isAuthor || isAdmin;
    let isPaid = false;
    const freeImagesCount = batchContext?.freeImagesCount ?? 3;

    if (user && article.requirePayment) {
      isPaid = batchContext
        ? batchContext.paidArticleIds.has(article.id)
        : await this.checkUserPaymentStatus(user.id, article.id);
    }

    const baseResponse = this.getBaseResponse(
      article.author,
      isLiked,
      article.downloads,
    );

    if (!hasFullAccess) {
      if (article.requireLogin && !user) {
        return {
          ...(await this.cropArticleContent(
            article,
            "login",
            undefined,
            freeImagesCount,
          )),
          ...baseResponse,
          isPaid: false,
        };
      }
      if (
        (article.requireFollow ||
          article.requireMembership ||
          article.requirePayment) &&
        !user
      ) {
        return {
          ...(await this.cropArticleContent(
            article,
            "login",
            undefined,
            freeImagesCount,
          )),
          ...baseResponse,
          isPaid: false,
        };
      }
      if (article.requireFollow && user) {
        const hasFollowed = batchContext
          ? batchContext.followedAuthorIds.has(article.author.id)
          : await this.checkUserFollowStatus(user.id, article.author.id);
        if (!hasFollowed) {
          return {
            ...(await this.cropArticleContent(
              article,
              "follow",
              undefined,
              freeImagesCount,
            )),
            ...baseResponse,
            isPaid,
          };
        }
      }
      if (article.requireMembership && user) {
        const hasMembership = this.checkUserMembershipStatus(user);
        if (!hasMembership) {
          return {
            ...(await this.cropArticleContent(
              article,
              "membership",
              undefined,
              freeImagesCount,
            )),
            ...baseResponse,
            isPaid,
          };
        }
      }
      if (article.requirePayment && user) {
        if (!isPaid) {
          return {
            ...(await this.cropArticleContent(
              article,
              "payment",
              article.viewPrice,
              freeImagesCount,
            )),
            ...baseResponse,
            isPaid: false,
          };
        }
      }
    }

    return {
      ...article,
      ...baseResponse,
      downloads: article.downloads,
      isPaid,
      imageCount: article.images
        ? typeof article.images === "string"
          ? article.images.split(",").filter((img) => img.trim() !== "").length
          : article.images.length
        : 0,
    };
  }

  private async checkUserFollowStatus(
    userId: number,
    authorId: number,
  ): Promise<boolean> {
    try {
      return await this.userService.isFollowing(userId, authorId);
    } catch (error) {
      console.error("检查用户关注状态失败", error);
      return false;
    }
  }

  private async checkUserPaymentStatus(userId: number, articleId: number) {
    try {
      return await this.orderService.hasPaidForArticle(userId, articleId);
    } catch (error) {
      console.error("检查用户支付状态失败", error);
      return false;
    }
  }

  private checkUserMembershipStatus(user: User) {
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
}
