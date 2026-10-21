import { Injectable, Inject, forwardRef } from "@nestjs/common";
import { LoggerUtil } from "src/common/utils/logger.util";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { InjectRepository } from "@nestjs/typeorm";
import { In, MoreThanOrEqual, Repository } from "typeorm";
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
import {
  UserCertificationService,
  PublicCertificationBadge,
} from "../user/user-certification.service";
import { OrderService } from "../order/order.service";
import { ContentAuditWorkflowService } from "../content-audit/content-audit-workflow.service";
import {
  ListUtil,
  PermissionUtil,
  sanitizeUser,
  processUserDecorations,
  ImageSerializer,
  checkMembershipStatus,
} from "../../common/utils";
import { extractHtmlSummary } from "../../common/utils/html-summary.util";

type ArticleBatchContext = {
  followedAuthorIds: Set<number>;
  blockedAuthorIds: Set<number>;
  paidArticleIds: Set<number>;
  parentCategoryMap: Map<number, Category>;
  freeImagesCount: number;
  activityMap: Map<number, DecorationActivity>;
  hotArticleIds: Set<number>;
  certificationMap: Map<number, PublicCertificationBadge>;
};

@Injectable()
export class ArticlePresentationService {
  private static readonly HOT_ARTICLE_CACHE_PREFIX = "article:hot-ids:";
  private static readonly HOT_ARTICLE_CACHE_TTL = 5 * 60 * 1000;

  constructor(
    @InjectRepository(Article)
    private articleRepository: Repository<Article>,
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
    private userCertificationService: UserCertificationService,
    private orderService: OrderService,
    private contentAuditWorkflowService: ContentAuditWorkflowService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  private getHotArticleCacheKey() {
    return `${ArticlePresentationService.HOT_ARTICLE_CACHE_PREFIX}${ArticleService.HOT_ARTICLE_WINDOW_DAYS}d`;
  }

  async invalidateHotArticleCache() {
    await this.cacheManager.del(this.getHotArticleCacheKey());
  }

  private async getCachedHotArticleIds() {
    const cacheKey = this.getHotArticleCacheKey();
    const cached = await this.cacheManager.get<number[]>(cacheKey);
    if (cached) {
      return new Set(cached);
    }

    const recentHotArticleCutoff = new Date();
    recentHotArticleCutoff.setDate(
      recentHotArticleCutoff.getDate() - ArticleService.HOT_ARTICLE_WINDOW_DAYS,
    );
    const hotConfig = await this.configService.getArticleHotConfig();

    const recentArticles = await this.articleRepository.find({
      where: {
        status: "PUBLISHED",
        createdAt: MoreThanOrEqual(recentHotArticleCutoff),
      },
      select: [
        "id",
        "views",
        "likes",
        "commentCount",
        "favoriteCount",
        "isFeatured",
        "createdAt",
      ],
    });

    const recentCandidates = recentArticles
      .filter(
        (article) =>
          (Number(article.views) || 0) >= hotConfig.minViews &&
          (Number(article.commentCount) || 0) >= hotConfig.minComments &&
          ((Number(article.likes) || 0) >= hotConfig.minLikes ||
            (Number(article.favoriteCount) || 0) >= hotConfig.minFavorites),
      )
      .map((article) => ({
        id: article.id,
        trendingScore: ArticleService.calculateTrendingScore(article),
      }))
      .sort((a, b) => b.trendingScore - a.trendingScore);

    const hotLimit =
      recentCandidates.length >= 3 ? 3 : recentCandidates.length > 0 ? 1 : 0;
    const hotArticleIds = recentCandidates
      .slice(0, hotLimit)
      .map((article) => article.id);

    await this.cacheManager.set(
      cacheKey,
      hotArticleIds,
      ArticlePresentationService.HOT_ARTICLE_CACHE_TTL,
    );

    return new Set(hotArticleIds);
  }

  private attachHotArticleMeta(article: any, hotArticleIds: Set<number>) {
    const hotScore = ArticleService.calculateHotScore(article);
    article.hotScore = hotScore;
    article.isHot = hotArticleIds.has(article.id);
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
    const uploadMap = await this.loadReferencedUploadMap(data);

    for (const article of data) {
      this.attachParentCategory(article, batchContext.parentCategoryMap);
      this.attachActivity(article, batchContext.activityMap);
      this.attachHotArticleMeta(article, batchContext.hotArticleIds);
      this.processArticleImages(article, uploadMap);
      this.fillArticleSummaryFromContent(article);
    }

    let userLikedArticleIds: Set<number> = new Set();
    const userReactionMap: Map<number, string> = new Map();
    let userFavoritedArticleIds: Set<number> = new Set();

    if (user && articleIds.length > 0) {
      const userLikes = await this.articleLikeRepository.find({
        where: {
          userId: user.id,
          articleId: In(articleIds),
        },
        select: ["articleId", "reactionType"],
      });

      userLikedArticleIds = new Set(
        userLikes.map((like) => like.articleId),
      );

      userLikes.forEach((like) => {
        userReactionMap.set(like.articleId, like.reactionType);
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
            isMember: checkMembershipStatus(article.author),
            isFollowed: user
              ? batchContext.followedAuthorIds.has(article.author.id)
              : false,
            isBlocked: user
              ? batchContext.blockedAuthorIds.has(article.author.id)
              : false,
            certification:
              batchContext.certificationMap.get(article.author.id) ?? null,
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
    this.attachHotArticleMeta(article, batchContext.hotArticleIds);
    this.processArticleImages(
      article,
      await this.loadReferencedUploadMap([article]),
    );
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
        isMember: checkMembershipStatus(article.author),
        isFollowed: currentUser
          ? batchContext.followedAuthorIds.has(article.author.id)
          : false,
        isBlocked: currentUser
          ? batchContext.blockedAuthorIds.has(article.author.id)
          : false,
        certification:
          batchContext.certificationMap.get(article.author.id) ?? null,
      };
    }

    return processedArticle;
  }

  async prepareBasicArticle(article: Article) {
    const batchContext = await this.buildArticleBatchContext([article]);
    this.attachParentCategory(article, batchContext.parentCategoryMap);
    this.attachActivity(article, batchContext.activityMap);
    this.attachHotArticleMeta(article, batchContext.hotArticleIds);
    this.processArticleImages(
      article,
      await this.loadReferencedUploadMap([article]),
    );
    this.fillArticleSummaryFromContent(article);

    if (article.author) {
      const certification =
        await this.userCertificationService.getPublicCertification(
          article.author.id,
        );
      article.author = {
        ...sanitizeUser(processUserDecorations(article.author)),
        certification,
      };
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
      hotArticleIds,
      parentCategories,
      followedAuthorIds,
      blockedAuthorIds,
      paidArticleIds,
      freeImagesCount,
      activities,
      certificationMap,
    ] = await Promise.all([
      this.getCachedHotArticleIds(),
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
      this.userCertificationService.getPublicCertifications(authorIds),
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
      hotArticleIds,
      certificationMap,
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

  /**
   * 收集一批文章引用的全部图片 URL（封面 / 图集 / 正文），供一次查询复用。
   */
  private collectArticleUploadUrls(articles: Article[]): string[] {
    const urls = new Set<string>();

    for (const article of articles) {
      if (article.cover && typeof article.cover === "string") {
        urls.add(article.cover);
      }
      for (const url of ImageSerializer.extractUrls(article.images as any)) {
        urls.add(url);
      }
      if (article.content) {
        for (const url of this.contentAuditWorkflowService.extractRichTextImageUrls(
          article.content,
        )) {
          urls.add(url);
        }
      }
    }

    return Array.from(urls);
  }

  /**
   * 一次性加载这批文章引用的 Upload 记录，构建 url → Upload 映射。
   * 替代原先每篇文章、每类图片各自查库的多次往返。
   */
  private async loadReferencedUploadMap(
    articles: Article[],
  ): Promise<Map<string, Upload>> {
    const uploadMap = new Map<string, Upload>();
    const urls = this.collectArticleUploadUrls(articles);

    if (urls.length === 0) {
      return uploadMap;
    }

    const uploads = await this.uploadRepository.find({
      where: { url: In(urls) },
      cache: false,
    });

    for (const upload of uploads) {
      uploadMap.set(upload.url, upload);
      if (upload.original?.url) {
        uploadMap.set(upload.original.url, upload);
      }
      if (upload.thumbnails) {
        for (const thumb of upload.thumbnails) {
          uploadMap.set(thumb.url, upload);
        }
      }
    }

    return uploadMap;
  }

  private pickUploads(
    uploadMap: Map<string, Upload>,
    urls: string[],
  ): Upload[] {
    const uploads = new Set<Upload>();
    for (const url of urls) {
      const upload = uploadMap.get(url);
      if (upload) {
        uploads.add(upload);
      }
    }
    return Array.from(uploads);
  }

  private processArticleImages(
    article: Article,
    uploadMap: Map<string, Upload>,
  ) {
    this.processArticleCover(article, uploadMap);

    const imageUrls = ImageSerializer.extractUrls(article.images as any);

    if (imageUrls.length > 0) {
      article.images = ImageSerializer.processImagesWithUploads(
        imageUrls,
        this.pickUploads(uploadMap, imageUrls),
        undefined,
        "/images/blocked.webp",
        ContentAuditWorkflowService.PENDING_PLACEHOLDER,
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
      const contentImageUrls =
        this.contentAuditWorkflowService.extractRichTextImageUrls(
          article.content,
        );

      article.images = ImageSerializer.processImagesWithUploads(
        contentImageUrls,
        this.pickUploads(uploadMap, contentImageUrls),
        undefined,
        "/images/blocked.webp",
        ContentAuditWorkflowService.PENDING_PLACEHOLDER,
      ) as any;
    }

    article.content = this.maskPendingImagesInContent(
      article.content,
      uploadMap,
    );
  }

  private processArticleCover(
    article: Article,
    uploadMap: Map<string, Upload>,
  ) {
    if (!article.cover || typeof article.cover !== "string") {
      return;
    }

    const upload = uploadMap.get(article.cover);
    if (!upload) {
      return;
    }

    if (upload.auditStatus === "pending") {
      article.cover = ContentAuditWorkflowService.PENDING_PLACEHOLDER;
      return;
    }

    if (upload.auditStatus === "rejected") {
      article.cover = ContentAuditWorkflowService.BLOCKED_PLACEHOLDER;
      return;
    }

    article.cover = upload.url;
  }

  private fillArticleSummaryFromContent(article: Article) {
    if (article.summary && article.summary.trim() !== "") {
      return;
    }

    const summary = extractHtmlSummary(article.content, 180);
    if (summary) {
      article.summary = summary;
    }
  }
  private maskPendingImagesInContent(
    content: string | undefined,
    uploadMap: Map<string, Upload>,
  ): string {
    if (!content || typeof content !== "string") {
      return content || "";
    }

    const contentImageUrls =
      this.contentAuditWorkflowService.extractRichTextImageUrls(content);
    if (contentImageUrls.length === 0) {
      return content;
    }

    let nextContent = content;

    for (const [url, upload] of uploadMap.entries()) {
      if (!url || upload.auditStatus === "approved") {
        continue;
      }
      if (!nextContent.includes(url)) {
        continue;
      }

      nextContent = nextContent
        .split(url)
        .join(
          upload.auditStatus === "pending"
            ? ContentAuditWorkflowService.PENDING_PLACEHOLDER
            : ContentAuditWorkflowService.BLOCKED_PLACEHOLDER,
        );
    }

    return nextContent;
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
        const hasMembership = checkMembershipStatus(user);
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
      LoggerUtil.error("检查用户关注状态失败", error, "ArticlePresentationService");
      return false;
    }
  }

  private async checkUserPaymentStatus(userId: number, articleId: number) {
    try {
      return await this.orderService.hasPaidForArticle(userId, articleId);
    } catch (error) {
      LoggerUtil.error("检查用户支付状态失败", error, "ArticlePresentationService");
      return false;
    }
  }
}
