import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
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
import { UserConfig } from "../user/entities/user-config.entity";
import { Category } from "../category/entities/category.entity";
import { Tag } from "../tag/entities/tag.entity";
import { ArticleLike } from "./entities/article-like.entity";
import { ArticleFavorite } from "./entities/article-favorite.entity";
import { Download, DownloadType } from "./entities/download.entity";
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
import { TelegramDownloadService } from "./telegram-download.service";

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
    @InjectRepository(ArticleFavorite)
    private articleFavoriteRepository: Repository<ArticleFavorite>,
    @InjectRepository(Download)
    private downloadRepository: Repository<Download>,
    @InjectRepository(BrowseHistory)
    private browseHistoryRepository: Repository<BrowseHistory>,
    @InjectRepository(FavoriteItem)
    private favoriteItemRepository: Repository<FavoriteItem>,
    @InjectRepository(UserConfig)
    private userConfigRepository: Repository<UserConfig>,
    private tagService: TagService,
    private userService: UserService,
    private orderService: OrderService,
    private configService: ConfigService,
    private enhancedNotificationService: EnhancedNotificationService,
    private eventEmitter: EventEmitter2,
    private telegramDownloadService: TelegramDownloadService,
  ) { }

  /**
   * 閸掓稑缂撻弬鍥╃彿
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
    // 閺屻儲澹橀崚鍡欒
    const category = await this.categoryRepository.findOne({
      where: { id: categoryId },
    });
    if (!category) {
      throw new NotFoundException("response.error.categoryNotFound");
    }

    // 婢跺嫮鎮?images 鐎涙顔岄敍姘洤閺嬫粍妲搁弫鎵矋閸掓瑨娴嗛幑顫礋闁褰块崚鍡涙閻ㄥ嫬鐡х粭锔胯
    if (articleData.images && Array.isArray(articleData.images)) {
      articleData.images = articleData.images.join(",");
    }

    // 閸掓稑缂撻弬鍥╃彿
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

    // 閸掋倖鏌囬弰顖氭儊闂団偓鐟曚礁顓搁弽?
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

    // 婢跺嫮鎮婇弽鍥╊劮
    const tags: Tag[] = [];

    // 婵″倹鐏夐張澶嬬垼缁涚盯D閿涘本鐓￠幍鍓у箛閺堝鐖ｇ粵?
    if (tagIds && tagIds.length > 0) {
      const existingTags = await this.tagRepository.find({
        where: { id: In(tagIds) },
      });
      tags.push(...existingTags);
    }

    // 婵″倹鐏夐張澶嬬垼缁涙儳鎮曠粔甯礉閸掓稑缂撻幋鏍ㄧ叀閹电偓鐖ｇ粵?
    if (tagNames && tagNames.length > 0) {
      const createdTags = await this.tagService.findOrCreateTags(tagNames);
      // 闁灝鍘ら柌宥咁槻濞ｈ濮?
      createdTags.forEach((tag) => {
        if (!tags.find((t) => t.id === tag.id)) {
          tags.push(tag);
        }
      });
    }

    article.tags = tags;
    const savedArticle = await this.articleRepository.save(article);

    // 婢跺嫮鎮婃稉瀣祰鐠у嫭绨?
    if (downloads && downloads.length > 0) {
      const downloadEntities = downloads.map((downloadData) =>
        this.downloadRepository.create({
          ...downloadData,
          articleId: savedArticle.id,
        }),
      );
      await this.downloadRepository.save(downloadEntities);
    }

    // 闁插秵鏌婇弻銉嚄閺傚洨鐝锋禒銉ュ瘶閸氼偂绗呮潪鍊熺カ濠ф劕鎷版担婊嗏偓鍛邦棅妤楁澘鎼?
    const articleWithDownloads = await this.articleRepository.findOne({
      where: { id: savedArticle.id },
      relations: ["author", "author.userDecorations", "author.userDecorations.decoration", "category", "tags", "downloads"],
    });

    // 婢跺嫮鎮婇崶鍓у鐎涙顔?
    this.processArticleImages(articleWithDownloads!);

    // 濞ｈ濮瀒mageCount鐎涙顔?
    if (articleWithDownloads) {
      articleWithDownloads['imageCount'] = articleWithDownloads.images ?
        (typeof articleWithDownloads.images === "string" ?
          articleWithDownloads.images.split(",").filter(img => img.trim() !== "").length :
          articleWithDownloads.images.length) : 0;
    }

    // 閸欘亝婀侀崣鎴濈閻樿埖鈧胶娈戦弬鍥╃彿閹靛秴顤冮崝鐘侯吀閺?
    if (savedArticle.status === 'PUBLISHED') {
      // 婢х偛濮為悽銊﹀煕閸欐垵绔烽弬鍥╃彿閺佷即鍣?
      this.userService.incrementArticleCount(author.id);
      // 婢х偛濮為崚鍡欒閺傚洨鐝烽弫浼村櫤
      this.categoryRepository.increment({ id: category.id }, "articleCount", 1);
      // 婢х偛濮為弽鍥╊劮閺傚洨鐝烽弫浼村櫤
      for (const tag of tags) {
        await this.tagRepository.increment({ id: tag.id }, "articleCount", 1);
      }
    }

    // 鐟欙箑褰傞弬鍥╃彿閸掓稑缂撴禍瀣╂閿涘牏鏁ゆ禍搴Ｐ濋崚鍡欓兇缂佺噦绱?
    if (savedArticle.status === 'PUBLISHED') {
      try {
        this.eventEmitter.emit('article.created', {
          userId: author.id,
          articleId: savedArticle.id,
        });
      } catch (error) {
        console.error("鐟欙箑褰傞弬鍥╃彿閸掓稑缂撴禍瀣╂婢惰精瑙?", error);
      }
    }

    // 婢跺嫮鎮婃担婊嗏偓鍛邦棅妤楁澘鎼ч獮鑸电閻炲棙鏅遍幇鐔朵繆閹?
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
   * 閸掑棝銆夐弻銉嚄閹碘偓閺堝鏋冪粩?
   */
  async findAllArticles(
    pagination: PaginationDto,
    title?: string,
    categoryId?: number,
    user?: User,
    type?: "all" | "popular" | "latest" | "following",
    tagId?: number,
  ) {
    const hasPermission =
      user && PermissionUtil.hasPermission(user, "article:manage");

    // 閸╄櫣顢呴弶鈥叉閺勭姴鐨犻崳?
    const baseConditionMappers = [
      // 闂堢偟顓搁悶鍡楁喅閸欘亝鐓＄拠銏犲嚒閸欐垵绔烽弬鍥╃彿
      () => !hasPermission && { status: "PUBLISHED" as const },
      // 閺堫亞娅ヨぐ鏇犳暏閹磋渹绗夐弰鍓с仛閺嶅洩顔囨稉杞扮矌閻ц缍嶉崣顖濐潌閻ㄥ嫬鍨悰銊┿€?
      () => !user && { listRequireLogin: false },
      // 閺嶈宓侀弽鍥暯濡紕纭﹂弻銉嚄
      () => title && { title: Like(`%${title}%`) },
      // 閺嶈宓侀崚鍡欒ID閺屻儴顕?
      () => categoryId && { category: { id: categoryId } },
      // 閺嶈宓侀弽鍥╊劮ID閺屻儴顕?
      () => tagId && { tags: { id: tagId } },
    ];

    // 閸氬牆鑻熼崺铏诡攨閺夆€叉
    const baseWhereCondition = baseConditionMappers
      .map((mapper) => mapper())
      .filter(Boolean)
      .reduce((acc, curr) => ({ ...acc, ...curr }), {});

    const { page, limit } = pagination;

    // 閹绘劕褰囬崗顒€鍙￠惃鍕叀鐠囥垽鍘ょ純顕嗙礄濞ｈ濮炵憗鍛淬偘閸濅礁鍙ч懕鏃撶礆
    const commonRelations = ["author", "author.userDecorations", "author.userDecorations.decoration", "category", "tags", "downloads"];
    const commonPagination = {
      skip: (page - 1) * limit,
      take: limit,
    };

    let findOptions: FindManyOptions<Article>;

    // 閺嶈宓乼ype缁鐎烽弸鍕紦娑撳秴鎮撻惃鍕叀鐠囥垺娼禒?
    switch (type) {
      case "popular":
        // 閻戭參妫弬鍥╃彿閿涘牊瀵滃ù蹇氼潔闁插繑甯撴惔蹇ョ礆
        // 婵″倹鐏夋稉鈧稉顏呮箑閸愬懏鐥呴張澶嬫瀮缁旂媴绱濋崚娆庣瑝闂勬劕鍩楅弮鍫曟？閼煎啫娲?
        const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        // 閸忓牆鐨剧拠鏇熺叀鐠囶澀绔存稉顏呮箑閸愬懐娈戦弬鍥╃彿
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

        // 濡偓閺屻儰绔存稉顏呮箑閸愬懏妲搁崥锔芥箒閺傚洨鐝烽敍灞筋洤閺嬫粍鐥呴張澶婂灟娑撳秹妾洪崚鑸垫闂傜瀵栭崶?
        const popularTotal = await this.articleRepository.count(findOptions);

        if (popularTotal === 0) {
          // 婵″倹鐏夋稉鈧稉顏呮箑閸愬懏鐥呴張澶嬫瀮缁旂媴绱濋崚娆愮叀鐠囥垺澧嶉張澶嬫瀮缁?
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
        // 閺堚偓閺傜増鏋冪粩?
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
        // 閻劍鍩涢崗铏暈閻ㄥ嫪缍旈懓鍛瀮缁旂媴绱欓棁鈧憰浣烘暏閹撮娅ヨぐ鏇礆
        if (!user) {
          // 婵″倹鐏夐悽銊﹀煕閺堫亞娅ヨぐ鏇礉鏉╂柨娲栫粚鍝勫灙鐞?
          return ListUtil.buildPaginatedList([], 0, page, limit);
        }

        // 閼惧嘲褰囬悽銊﹀煕閸忚櫕鏁為惃鍕稊閼板將D閸掓銆?
        const followingUsers = await this.userService
          .getUserRepository()
          .createQueryBuilder("user")
          .innerJoin("user.followers", "follower", "follower.id = :userId", {
            userId: user.id,
          })
          .getMany();

        const followingUserIds = followingUsers.map((u) => u.id);

        // 婵″倹鐏夊▽鈩冩箒閸忚櫕鏁炴禒璁崇秿娴ｆ粏鈧拑绱濇潻鏂挎礀缁屽搫鍨悰?
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
            // 閸忓牊瀵滈幒鎺戠碍閿涘瞼鍔ч崥搴㈠瘻閺堚偓閺傞绱崗鍫礉閺堚偓閸氬孩瀵滈悜顓炲
            sort: "DESC" as const,
            createdAt: "DESC" as const,
            views: "DESC" as const,
          },
          ...commonPagination,
        };
        break;

      default:
        // all 閹存牗婀幐鍥х暰type閺冩湹濞囬悽銊╃帛鐠併倖鐓＄拠?
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
   * 婢跺嫮鎮婇弬鍥╃彿缂佹挻鐏夐敍灞藉瘶閹奉剙鍨庣猾鑽ゅ煑缁狙冾槱閻炲棎鈧礁娴橀悧鍥ь槱閻炲棗鎷伴弶鍐濡偓閺?
   */
  private async processArticleResults(
    data: Article[],
    total: number,
    page: number,
    limit: number,
    user?: User,
  ) {
    // 婢跺嫮鎮婇崚鍡欒閻ㄥ嫮鍩楃痪褍鍨庣猾?
    for (const article of data) {
      if (article.category && article.category.parentId) {
        // 濡偓閺岊櫠arentId閺勵垰鎯侀弰顖濆殰瀹?
        if (article.category.parentId !== article.category.id) {
          const parentCategory = await this.categoryRepository.findOne({
            where: { id: article.category.parentId },
          });
          if (parentCategory) {
            article.category.parent = parentCategory;
          }
        }
      }
      // 婢跺嫮鎮婇崶鍓у
      this.processArticleImages(article);
      this.fillArticleSummaryFromContent(article);
    }

    // 閺屻儴顕楅悽銊﹀煕閻愮绂愰悩鑸碘偓?- 閺傛澘顤冩禒锝囩垳
    let userLikedArticleIds: Set<number> = new Set();
    let userReactionMap: Map<number, string> = new Map();
    // 閺屻儴顕楅悽銊﹀煕閺€鎯版閻樿埖鈧?
    let userFavoritedArticleIds: Set<number> = new Set();
    if (user) {
      const articleIds = data.map((article) => article.id);
      const userLikes = await this.articleLikeRepository.find({
        where: {
          user: { id: user.id },
          article: { id: In(articleIds) },
        },
        relations: ["article"],
      });
      // 娣囶喗顒滈敍姘崇箖濠娿倖甯€ article 娑?undefined 閻ㄥ嫯顔囪ぐ?
      userLikedArticleIds = new Set(
        userLikes
          .filter((like) => like.article) // 绾喕绻?article 鐎涙ê婀?
          .map((like) => like.article.id),
      );

      // 閺嬪嫬缂撻悽銊﹀煕reaction閺勭姴鐨?
      userLikes
        .filter((like) => like.article)
        .forEach((like) => {
          userReactionMap.set(like.article.id, like.reactionType);
        });

      // 閹靛綊鍣洪弻銉嚄閻劍鍩涢弨鎯版閻樿埖鈧?
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

    // 閹靛綊鍣洪懢宄板絿閹碘偓閺堝鏋冪粩鐘垫畱reaction缂佺喕顓?
    const articleIds = data.map((article) => article.id);
    const reactionStatsMap = await this.getBatchReactionStats(articleIds);

    // 婢跺嫮鎮婂В蹇曠槖閺傚洨鐝烽惃鍕綀闂勬劕鎷伴崘鍛啇鐟佷礁澹€
    const processedArticles = await Promise.all(
      data.map(async (article) => {
        const processedArticle = await this.processArticlePermissions(
          article,
          user,
          userLikedArticleIds.has(article.id),
        );

        // 濞ｈ濮瀝eaction缂佺喕顓搁崪宀€鏁ら幋绌渆action閻樿埖鈧?
        (processedArticle as any).reactionStats = reactionStatsMap.get(article.id) || {
          like: 0,
          love: 0,
          haha: 0,
          wow: 0,
          sad: 0,
          angry: 0,
          dislike: 0,
        };
        
        // 濞ｈ濮為悽銊﹀煕閻ㄥ墔eaction缁鐎烽敍鍫濐潗缂佸牐绻戦崶鐑囩礉濞屸剝婀侀崚娆庤礋 null閿?
        (processedArticle as any).userReaction = user && userReactionMap.has(article.id)
          ? userReactionMap.get(article.id)
          : null;

        // 濞ｈ濮為弨鎯版閻樿埖鈧?
        (processedArticle as any).isFavorited = userFavoritedArticleIds.has(article.id);

        // 濞ｈ濮炴担婊嗏偓鍛畱娴兼艾鎲抽崪灞藉彠濞夈劎濮搁幀渚婄礉楠炶泛顦╅悶鍡氼棅妤楁澘鎼?
        const isMember = await this.checkUserMembershipStatus(article.author);
        const isFollowed = user
          ? await this.userService.isFollowing(user.id, article.author.id)
          : false;
        
        processedArticle.author = {
          ...processUserDecorations(processedArticle.author),
          isMember,
          isFollowed,
        };
        
        return processedArticle;
      }),
    );

    return ListUtil.buildPaginatedList(processedArticles, total, page, limit);
  }

  /**
   * 閺嶈宓両D閺屻儴顕楅弬鍥╃彿鐠囷附鍎?
   */
  async findOne(id: number, currentUser?: User) {
    // 閺勵垰鎯侀張澶嬫綀闂勬劖鐓￠惇瀣弓閸欐垵绔烽惃鍕瀮缁?
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

    // 婢跺嫮鎮婇崚鍡欒閻ㄥ嫮鍩楃痪褍鍨庣猾?
    if (article.category && article.category.parentId) {
      // 濡偓閺岊櫠arentId閺勵垰鎯侀弰顖濆殰瀹?
      if (article.category.parentId !== article.category.id) {
        const parentCategory = await this.categoryRepository.findOne({
          where: { id: article.category.parentId },
        });
        if (parentCategory) {
          article.category.parent = parentCategory;
        }
      }
    }

    // 濡偓閺屻儱缍嬮崜宥囨暏閹撮攱妲搁崥锔惧仯鐠х偠顕氶弬鍥╃彿
    let isLiked = false;
    let userReaction: string | undefined;
    if (currentUser) {
      const userLike = await this.articleLikeRepository.findOne({
        where: {
          user: { id: currentUser.id },
          article: { id: article.id },
        },
      });
      isLiked = !!userLike;
      userReaction = userLike?.reactionType;
    }

    // 婢х偛濮為梼鍛邦嚢闁?
    await this.incrementViews(id);

    // 鐠佹澘缍嶅ù蹇氼潔閸樺棗褰堕敍鍫濐洤閺嬫粎鏁ら幋宄板嚒閻ц缍嶉敍?
    if (currentUser) {
      try {
        await this.recordBrowseHistory(currentUser.id, id);
      } catch (error) {
        // 濞村繗顫嶉崢鍡楀蕉鐠佹澘缍嶆径杈Е娑撳秴濂栭崫宥勫瘜濞翠胶鈻?
        console.error('鐠佹澘缍嶅ù蹇氼潔閸樺棗褰舵径杈Е:', error);
      }
    }

    // 婢跺嫮鎮婇崶鍓у鐎涙顔?
    this.processArticleImages(article);
      this.fillArticleSummaryFromContent(article);

    // 娴ｈ法鏁ら柅姘辨暏閺傝纭舵径鍕倞閺夊啴妾洪崪灞藉敶鐎圭顥嗛崜?
    const processedArticle = await this.processArticlePermissions(
      article,
      currentUser,
      isLiked,
    );

    // 濞ｈ濮瀝eaction缂佺喕顓?
    (processedArticle as any).reactionStats = await this.getReactionStats(article.id);

    // 濞ｈ濮為悽銊﹀煕閻ㄥ墔eaction閻樿埖鈧緤绱欐慨瀣矒鏉╂柨娲栭敍灞剧梾閺堝鍨稉?null閿?
    (processedArticle as any).userReaction = userReaction || null;

    // 濞ｈ濮為弨鎯版閻樿埖鈧?
    if (currentUser) {
      const favoriteStatus = await this.checkFavoriteStatus(article.id, currentUser.id);
      (processedArticle as any).isFavorited = favoriteStatus.isFavorited;
    } else {
      (processedArticle as any).isFavorited = false;
    }

    // 濞ｈ濮炴担婊嗏偓鍛畱娴兼艾鎲抽崪灞藉彠濞夈劎濮搁幀?
    if (processedArticle.author) {
      const isMember = await this.checkUserMembershipStatus(article.author);
      const isFollowed = currentUser
        ? await this.userService.isFollowing(currentUser.id, article.author.id)
        : false;
      
      processedArticle.author = {
        ...processedArticle.author,
        isMember,
        isFollowed,
      };
    }

    // 婢跺嫮鎮婇弨鎯版婢堕€涗繆閹垽绱伴崣顏呮▔缁€鐑樻瀮缁旂姳缍旈懓鍛灡瀵よ櫣娈戞稉鈧稉顏呮暪閽樺繐銇欓敍灞惧笓闂勩倗鏁ら幋铚備繆閹?
    if (processedArticle.author) {
      const authorFavoriteItem = await this.favoriteItemRepository.findOne({
        where: {
          articleId: processedArticle.id,
          userId: processedArticle.author.id,
        },
        relations: ['favorite', 'favorite.items', 'favorite.items.article'],
        order: { createdAt: 'DESC' }, // 閼惧嘲褰囬張鈧弬鎵畱娑撯偓娑?
      });

      if (authorFavoriteItem && authorFavoriteItem.favorite) {
        const { user, userId, items, ...favoriteData } = authorFavoriteItem.favorite;

        // 娴?items 娑擃厽澹樻稉濠佺缁″洤鎷版稉瀣╃缁?
        const currentSort = authorFavoriteItem.sort;
        const publishedItems = items
          .filter(item => item.article && item.article.status === 'PUBLISHED')
          .sort((a, b) => a.sort - b.sort);

        const currentIndex = publishedItems.findIndex(item => item.id === authorFavoriteItem.id);
        const prevItem = currentIndex > 0 ? publishedItems[currentIndex - 1] : null;
        const nextItem = currentIndex < publishedItems.length - 1 ? publishedItems[currentIndex + 1] : null;

        // 鐏忓棙鏁归挊蹇撱仚娣団剝浼呴崪灞筋嚤閼割亙淇婇幁顖欑鐠ч攱鏂侀崚?favorite 娑?
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
   * 婢跺嫮鎮婇弬鍥╃彿閸ュ墽澧栫€涙顔?
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

  private extractSummaryFromHtml(html?: string, maxLength: number = 180): string {
    if (!html || typeof html !== "string") {
      return "";
    }

    const noScript = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ");

    const withBreaks = noScript
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|h1|h2|h3|h4|h5|h6|li|blockquote)>/gi, "\n");

    const plainText = withBreaks
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

    return plainText.length > maxLength
      ? `${plainText.slice(0, maxLength).trim()}...`
      : plainText;
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
   * 鐟佷礁澹€閺傚洨鐝烽崘鍛啇
   * @param article 閺傚洨鐝风€电钖?
   * @param restrictionType 闂勬劕鍩楃猾璇茬€?
   * @param price 娴犻攱鐗?
   */
  private async cropArticleContent(
    article: Article,
    restrictionType: string,
    price?: number,
  ) {
    // 閼惧嘲褰囬柊宥囩枂閻ㄥ嫬鍘ょ拹鐟版禈閻楀洦鏆熼柌蹇ョ礄閼奉亜濮╂担璺ㄦ暏缂傛挸鐡ㄩ敍?
    const freeImagesCount =
      await this.configService.getArticleFreeImagesCount();

    // 婢跺嫮鎮婇崶鍓у閿涘奔绻氶悾娆撳帳缂冾喚娈戦崗宥堝瀭閸ュ墽澧栭弫浼村櫤
    let previewImages: string[] = [];

    if (article.images) {
      let imageArray: string[] = [];

      // 婢跺嫮鎮婇崣顖濆厴閺勵垰鐡х粭锔胯閹存牗鏆熺紒鍕畱閹懎鍠?
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

    // 閺嶈宓侀弬鍥╃彿缁鐎烽崘鍐茬暰鐟佷礁澹€缁涙牜鏆?
    if (article.type === "mixed") {
      // mixed缁鐎烽敍姘涧闂呮劘妫屾稉瀣祰娣団剝浼呴敍灞肩箽閻ｆ瑦鏋冪粩鐘插敶鐎圭懓鎷伴幍鈧張澶婃禈閻?
      // 鏉╁洦鎶ら崙鐑樻￥闂団偓閺夊啴妾洪崡鍐插讲閺勫墽銇氶惃鍕瑓鏉炲€熺カ濠?
      const visibleDownloads = article.downloads?.filter(d => d.visibleWithoutPermission) || [];
      const croppedArticle = {
        ...article,
        downloads: visibleDownloads, // 閸欘亝妯夌粈鐑樻￥闂団偓閺夊啴妾洪惃鍕瑓鏉炲€熺カ濠?
        imageCount: article.images.length || 0,
        downloadCount: article.downloads ? article.downloads.length : 0, // 閺勫墽銇氱挧鍕爱閺佷即鍣?
      };
      return croppedArticle;
    } else {
      // image缁鐎烽敍姘箽閹镐礁甯弶銉ф畱闁槒绶敍宀勬閽樺繐鍞寸€圭懓鎷伴梽鎰煑閸ュ墽澧?
      // 鏉╁洦鎶ら崙鐑樻￥闂団偓閺夊啴妾洪崡鍐插讲閺勫墽銇氶惃鍕瑓鏉炲€熺カ濠?
      const visibleDownloads = article.downloads?.filter(d => d.visibleWithoutPermission) || [];
      const croppedArticle = {
        ...article,
        images: previewImages as any, // 娣囨繄鏆€闁板秶鐤嗛惃鍕帳鐠愮懓娴橀悧鍥ㄦ殶闁?
        imageCount: article.images.length || 0,
        downloads: visibleDownloads, // 閸欘亝妯夌粈鐑樻￥闂団偓閺夊啴妾洪惃鍕瑓鏉炲€熺カ濠?
        downloadCount: article.downloads ? article.downloads.length : 0, // 閺勫墽銇氱挧鍕爱閺佷即鍣?
      };
      return croppedArticle;
    }
  }

  /**
   * 閹绘劕褰囬崗顒€鍙￠惃鍕箲閸ョ偛顕挒锛勭波閺嬪嫸绱欐径鍕倞鐟佸懘銈伴崫渚婄礆
   */
  private getBaseResponse(author: User, isLiked: boolean, downloads: any[]) {
    // 鏉╁洦鎶ら崙鐑樻￥闂団偓閺夊啴妾洪崡鍐插讲閺勫墽銇氶惃鍕瑓鏉炲€熺カ濠?
    const visibleDownloads = downloads?.filter(d => d.visibleWithoutPermission) || [];
    return {
      author: sanitizeUser(processUserDecorations(author)),
      downloads: visibleDownloads,
      downloadCount: downloads ? downloads.length : 0,
      isLiked,
    };
  }

  /**
   * 婢跺嫮鎮婇弬鍥╃彿閺夊啴妾洪崪灞藉敶鐎圭顥嗛崜顏庣礄闁氨鏁ら弬瑙勭《閿?
   * @param article 閺傚洨鐝风€电钖?
   * @param user 瑜版挸澧犻悽銊﹀煕
   * @param isLiked 閺勵垰鎯佸鑼仯鐠?
   */
  private async processArticlePermissions(
    article: Article,
    user?: User,
    isLiked: boolean = false,
  ) {
    // 濡偓閺屻儲妲搁崥锔芥Ц娴ｆ粏鈧懏鍨ㄧ粻锛勬倞閸?
    const isAuthor = user && user.id === article.author.id;
    const isAdmin =
      user && PermissionUtil.hasPermission(user, "article:manage");
    const hasFullAccess = isAuthor || isAdmin;

    // 濡偓閺屻儳鏁ら幋閿嬫Ц閸氾箑鍑￠弨顖欑帛閿涘牏鏁ゆ禍?isPaid 鐎涙顔岄敍?
    let isPaid = false;
    if (user && article.requirePayment) {
      isPaid = await this.checkUserPaymentStatus(user.id, article.id);
    }

    // 閹绘劕褰囬崗顒€鍙￠惃鍕箲閸ョ偛顕挒锛勭波閺嬪嫸绱欐担璺ㄦ暏閺傜増鏌熷▔鏇礆
    const baseResponse = this.getBaseResponse(article.author, isLiked, article.downloads);

    // 婵″倹鐏夊▽鈩冩箒鐎瑰本鏆ｉ弶鍐閿涘矁绻樼悰灞藉敶鐎圭顥嗛崜?
    if (!hasFullAccess) {
      // 濡偓閺屻儳娅ヨぐ鏇熸綀闂?- 婵″倹鐏夌拋鍓х枂娴滃棛娅ヨぐ鏇熸綀闂勬劒绲鹃悽銊﹀煕閺堫亞娅ヨぐ鏇礉閻╁瓨甯存潻鏂挎礀鐟佷礁澹€閸愬懎顔?
      if (article.requireLogin && !user) {
        return {
          ...(await this.cropArticleContent(article, "login")),
          ...baseResponse,
          isPaid: false,
        };
      }

      // 婵″倹鐏夌拋鍓х枂娴滃棔鎹㈡担鏇熸綀闂勬劒绲鹃悽銊﹀煕閺堫亞娅ヨぐ鏇礉閻╁瓨甯存潻鏂挎礀閻ц缍嶉幓鎰仛
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

      // 濡偓閺屻儱鍙у▔銊︽綀闂?
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

      // 濡偓閺屻儰绱伴崨妯绘綀闂?
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

      // 濡偓閺屻儰绮拹瑙勬綀闂?
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

    // 閺堝鐣弫瀛樻綀闂勬劖鍨ㄩ弮鐘绘付闂勬劕鍩楅惃鍕瀮缁?
    return {
      ...article,
      ...baseResponse,
      downloads: article.downloads,
      isPaid,
      imageCount: article.images ? (typeof article.images === "string" ? article.images.split(",").filter(img => img.trim() !== "").length : article.images.length) : 0,
    };
  }

  /**
   * 閺囧瓨鏌婇弬鍥╃彿
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

    // 濡偓閺屻儲妲搁崥锔芥Ц娴ｆ粏鈧?
    if (
      currentUser.id !== article.authorId &&
      !PermissionUtil.hasPermission(currentUser, "article:manage")
    ) {
      throw new ForbiddenException("response.error.noPermission");
    }

    // 婢跺嫮鎮?images 鐎涙顔岄敍姘洤閺嬫粍妲搁弫鎵矋閸掓瑨娴嗛幑顫礋闁褰块崚鍡涙閻ㄥ嫬鐡х粭锔胯
    if (articleData.images && Array.isArray(articleData.images)) {
      articleData.images = articleData.images.join(",");
    }

    // 閺囧瓨鏌婇崚鍡欒
    if (categoryId) {
      // 娣囨繂鐡ㄩ弮褍鍨庣猾绫孌閿涘瞼鏁ゆ禍搴㈡纯閺傛媽顓搁弫?
      const oldCategoryId = article.category?.id;

      const category = await this.categoryRepository.findOne({
        where: { id: categoryId },
      });
      if (!category) {
        throw new Error("response.error.categoryNotFound");
      }
      article.category = category;

      // 閸欘亝婀侀崣鎴濈閻樿埖鈧胶娈戦弬鍥╃彿閹靛秵娲块弬鏉垮瀻缁槒顓搁弫?
      if (article.status === 'PUBLISHED' && oldCategoryId && oldCategoryId !== categoryId) {
        // 閸戝繐鐨弮褍鍨庣猾鑽ゆ畱閺傚洨鐝烽弫浼村櫤
        await this.categoryRepository.decrement({ id: oldCategoryId }, "articleCount", 1);
        // 婢х偛濮為弬鏉垮瀻缁崵娈戦弬鍥╃彿閺佷即鍣?
        await this.categoryRepository.increment({ id: categoryId }, "articleCount", 1);
      }
    }

    // 婢跺嫮鎮婇弽鍥╊劮閺囧瓨鏌?
    if (tagIds || tagNames) {
      // 娣囨繂鐡ㄩ弮褎鐖ｇ粵缍閿涘瞼鏁ゆ禍搴㈡纯閺傛媽顓搁弫?
      const oldTagIds = article.tags?.map(t => t.id) || [];

      const tags: Tag[] = [];

      // 婵″倹鐏夐張澶嬬垼缁涚盯D閿涘本鐓￠幍鍓у箛閺堝鐖ｇ粵?
      if (tagIds && tagIds.length > 0) {
        const existingTags = await this.tagRepository.find({
          where: { id: In(tagIds) },
        });
        tags.push(...existingTags);
      }

      // 婵″倹鐏夐張澶嬬垼缁涙儳鎮曠粔甯礉閸掓稑缂撻幋鏍ㄧ叀閹电偓鐖ｇ粵?
      if (tagNames && tagNames.length > 0) {
        const createdTags = await this.tagService.findOrCreateTags(tagNames);
        // 闁灝鍘ら柌宥咁槻濞ｈ濮?
        createdTags.forEach((tag) => {
          if (!tags.find((t) => t.id === tag.id)) {
            tags.push(tag);
          }
        });
      }

      const newTagIds = tags.map(t => t.id);

      // 閸欘亝婀侀崣鎴濈閻樿埖鈧胶娈戦弬鍥╃彿閹靛秵娲块弬鐗堢垼缁涙崘顓搁弫?
      if (article.status === 'PUBLISHED') {
        // 閺囧瓨鏌婇弮褎鐖ｇ粵鎹愵吀閺佸府绱欓崙蹇撶毌閿? 閸欘亜鍣虹亸鎴滅瑝閸愬秴鍙ч懕鏃傛畱閺嶅洨顒?
        for (const oldTagId of oldTagIds) {
          if (!newTagIds.includes(oldTagId)) {
            await this.tagRepository.decrement({ id: oldTagId }, "articleCount", 1);
          }
        }

        // 閺囧瓨鏌婇弬鐗堢垼缁涙崘顓搁弫甯礄婢х偛濮為敍? 閸欘亜顤冮崝鐘虫煀閸忓疇浠堥惃鍕垼缁?
        for (const newTagId of newTagIds) {
          if (!oldTagIds.includes(newTagId)) {
            await this.tagRepository.increment({ id: newTagId }, "articleCount", 1);
          }
        }
      }

      article.tags = tags;
    }

    // 娣囨繂鐡ㄩ弮褏濮搁幀渚婄礉閻劋绨悩鑸碘偓浣稿綁閺囧瓨妞傞惃鍕吀閺佺増娲块弬?
    const oldStatus = article.status;

    // 閺囧瓨鏌婇崗鏈电铂鐎涙顔?
    Object.assign(article, articleData);

    // 婢跺嫮鎮婇悩鑸碘偓浣稿綁閺囧瓨妞傞惃鍕吀閺佺増娲块弬?
    const newStatus = articleData.status as string | undefined;

    if (newStatus && oldStatus !== newStatus) {
      // 娴犲酣娼崣鎴濈閻樿埖鈧礁褰夋稉鍝勫絺鐢啰濮搁幀渚婄窗婢х偛濮炵拋鈩冩殶
      if (oldStatus !== 'PUBLISHED' && newStatus === 'PUBLISHED') {
        if (article.category) {
          await this.categoryRepository.increment({ id: article.category.id }, "articleCount", 1);
        }
        if (article.tags && article.tags.length > 0) {
          for (const tag of article.tags) {
            await this.tagRepository.increment({ id: tag.id }, "articleCount", 1);
          }
        }
        // 婢х偛濮為悽銊﹀煕閸欐垵绔烽弬鍥╃彿閺佷即鍣?
        this.userService.incrementArticleCount(article.authorId);
      }
      // 娴犲骸褰傜敮鍐Ц閹礁褰夋稉娲姜閸欐垵绔烽悩鑸碘偓渚婄窗閸戝繐鐨拋鈩冩殶
      else if (oldStatus === 'PUBLISHED' && newStatus !== 'PUBLISHED') {
        if (article.category) {
          await this.categoryRepository.decrement({ id: article.category.id }, "articleCount", 1);
        }
        if (article.tags && article.tags.length > 0) {
          for (const tag of article.tags) {
            await this.tagRepository.decrement({ id: tag.id }, "articleCount", 1);
          }
        }
        // 閸戝繐鐨悽銊﹀煕閸欐垵绔烽弬鍥╃彿閺佷即鍣?
        this.userService.decrementArticleCount(article.authorId);
      }
    }

    const updatedArticle = await this.articleRepository.save(article);

    // 婢跺嫮鎮婃稉瀣祰鐠у嫭绨弴瀛樻煀
    if (downloads !== undefined) {
      // 閸掔娀娅庨悳鐗堟箒閻ㄥ嫪绗呮潪鍊熺カ濠?
      await this.downloadRepository.delete({ articleId: id });

      // 閸掓稑缂撻弬鎵畱娑撳娴囩挧鍕爱
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

    // 闁插秵鏌婇弻銉嚄閺傚洨鐝锋禒銉ュ瘶閸氼偂绗呮潪鍊熺カ濠ф劕鎷版担婊嗏偓鍛邦棅妤楁澘鎼?
    const articleWithDownloads = await this.articleRepository.findOne({
      where: { id },
      relations: ["author", "author.userDecorations", "author.userDecorations.decoration", "category", "tags", "downloads"],
    });

    // 婢跺嫮鎮婇崶鍓у鐎涙顔?
    this.processArticleImages(articleWithDownloads!);

    // 濞ｈ濮瀒mageCount鐎涙顔?
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
   * 閸掔娀娅庨弬鍥╃彿
   */
  async remove(id: number, user: User) {
    // 濡偓閺屻儲鏋冪粩鐘虫Ц閸氾箑鐡ㄩ崷顭掔礉楠炶泛濮炴潪钘夊彠閼辨柨鍙х化?
    const article = await this.articleRepository.findOne({
      where: { id },
      relations: ["category", "tags"],
    });
    if (!article) {
      throw new NotFoundException("response.error.articleNotFound");
    }

    // 濡偓閺屻儲娼堥梽鎰剁窗閸欘亝婀佹担婊嗏偓鍛灗缁狅紕鎮婇崨妯哄讲娴犮儱鍨归梽銈嗘瀮缁?
    if (
      article.authorId !== user.id &&
      !PermissionUtil.hasPermission(user, "article:manage")
    ) {
      throw new ForbiddenException("response.error.noPermission");
    }

    // 娣囨繂鐡ㄩ崚鍡欒閸滃本鐖ｇ粵缍閿涘瞼鏁ゆ禍搴℃倵缂侇厽娲块弬鎷岊吀閺?
    const categoryId = article.category?.id;
    const tagIds = article.tags?.map((tag) => tag.id) || [];
    const wasPublished = article.status === 'PUBLISHED';

    // 閸掔娀娅庨弬鍥╃彿閿涘牏楠囬懕鏂垮灩闂勩倓绱伴懛顏勫З婢跺嫮鎮婇惄绋垮彠閺佺増宓侀敍?
    await this.articleRepository.remove(article);

    // 閸欘亝婀侀崣鎴濈閻樿埖鈧胶娈戦弬鍥╃彿閹靛秹娓剁憰浣稿櫤鐏忔垼顓搁弫?
    if (wasPublished) {
      // 閺囧瓨鏌婇崚鍡欒閺傚洨鐝烽弫浼村櫤
      if (categoryId) {
        await this.categoryRepository.decrement({ id: categoryId }, "articleCount", 1);
      }

      // 閺囧瓨鏌婇弽鍥╊劮閺傚洨鐝烽弫浼村櫤
      for (const tagId of tagIds) {
        await this.tagRepository.decrement({ id: tagId }, "articleCount", 1);
      }

      // 閸戝繐鐨悽銊﹀煕閸欐垵绔烽弬鍥╃彿閺佷即鍣?
      this.userService.decrementArticleCount(article.authorId);
    }

    return {
      success: true,
      message: "response.success.articleDelete",
    };
  }

  /**
   * 閻愮绂愰弬鍥╃彿閹存牗鍧婇崝鐘恒€冮幆鍛礀婢?
   */
  async like(articleId: number, user: User, likeDto?: ArticleLikeDto) {
    // 閻╁瓨甯撮弻銉嚄閺傚洨鐝烽敍宀勪缉閸忓秷鐨熼悽?findOne 鐎佃壈鍤ф晶鐐插闂冨懓顕伴柌?
    const article = await this.articleRepository.findOne({
      where: { id: articleId },
      relations: ["author"],
    });
    if (!article) {
      throw new NotFoundException("response.error.articleNotFound");
    }
    const reactionType = likeDto?.reactionType || "like";

    // 閺屻儲澹橀弰顖氭儊瀹稿弶婀佺悰銊﹀剰閸ョ偛顦?
    const existingLike = await this.articleLikeRepository.findOne({
      where: {
        articleId,
        userId: user.id,
      },
    });

    if (existingLike) {
      if (existingLike.reactionType === reactionType) {
        // 閻╃鎮撶悰銊﹀剰閿涘苯褰囧☉?
        await this.articleLikeRepository.remove(existingLike);
        
        // 閸欘亝婀侀崣鏍ㄧХ"like"缁鐎烽弮鑸靛閸戝繐鐨弬鍥╃彿閻愮绂愰弫?
        if (reactionType === "like") {
          await this.articleRepository.decrement({ id: articleId }, "likes", 1);
        }

        return {
          success: true,
          message: "response.success.reactionRemoved"
        };
      } else {
        // 娑撳秴鎮撶悰銊﹀剰閿涘本娲块弬?
        const oldReactionType = existingLike.reactionType;
        existingLike.reactionType = reactionType;
        await this.articleLikeRepository.save(existingLike);
        
        // 閺囧瓨鏌婇弬鍥╃彿閻愮绂愰弫甯窗婵″倹鐏夋禒搴ㄦ姜like閸欐ü璐焞ike閿涘苯顤冮崝鐙呯幢婵″倹鐏夋禒宸恑ke閸欐ü璐熼棃鐎昳ke閿涘苯鍣虹亸?
        if (oldReactionType !== "like" && reactionType === "like") {
          await this.articleRepository.increment({ id: articleId }, "likes", 1);
        } else if (oldReactionType === "like" && reactionType !== "like") {
          await this.articleRepository.decrement({ id: articleId }, "likes", 1);
        }
        
        return { 
          success: true,
          message: "response.success.reactionUpdated"
        };
      }
    } else {
      // 閺傛媽銆冮幆鍛礀婢?
      const like = this.articleLikeRepository.create({
        articleId,
        userId: user.id,
        reactionType,
      });
      await this.articleLikeRepository.save(like);
      
      // 閸欘亝婀?like"缁鐎烽幍宥咁杻閸旂姵鏋冪粩鐘靛仯鐠х偞鏆?
      if (reactionType === "like") {
        await this.articleRepository.increment({ id: articleId }, "likes", 1);
      }

      // 鐟欙箑褰傞悙纭呯娴滃娆㈤敍鍫㈡暏娴滃氦顥婃鏉挎惂濞茶濮╂潻娑樺閵嗕胶袧閸掑棛閮寸紒鐔锋嫲闁氨鐓￠敍?
      if (reactionType === "like") {
        try {
          this.eventEmitter.emit('article.liked', {
            userId: user.id,
            articleId,
            userName: user.nickname || user.username,
            articleTitle: article.title,
            authorId: article.author?.id,
          });
          // 鐟欙箑褰傞弬鍥╃彿鐞氼偆鍋ｇ挧鐐扮皑娴犺绱欑紒娆愭瀮缁旂姳缍旈懓鍛濋崚鍡礆
          if (article.author?.id && article.author.id !== user.id) {
            this.eventEmitter.emit('article.receivedLike', {
              authorId: article.author.id,
              articleId,
              likerId: user.id,
            });
          }
        } catch (error) {
          console.error("鐟欙箑褰傞悙纭呯娴滃娆㈡径杈Е:", error);
        }
      }

      return { 
        success: true,
        message: "response.success.reactionAdded"
      };
    }
  }

  /**
   * 閼惧嘲褰囬弬鍥╃彿閻愮绂愰悩鑸碘偓?
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
   * 閼惧嘲褰囬弬鍥╃彿閻愮绂愰弫?
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
   * 閼惧嘲褰囬弬鍥╃彿闊晜鏆?
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
   * 閼惧嘲褰囬弬鍥╃彿鐞涖劍鍎忛崶鐐差槻缂佺喕顓搁敍鍫滅喘閸栨牜澧楅張顒婄礉閸欘亞绮虹拋鈥茬瑝鏉╂柨娲栭弫鐗堝祦閿?
   */
  async getReactionStats(
    articleId: number,
  ): Promise<{ [key: string]: number }> {
    // 娴ｈ法鏁ら弫鐗堝祦鎼存捁浠涢崥鍫熺叀鐠囶澁绱濋幀褑鍏橀弴鏉戙偨
    const result = await this.articleLikeRepository
      .createQueryBuilder('articleLike')
      .select('articleLike.reactionType', 'reactionType')
      .addSelect('COUNT(*)', 'count')
      .where('articleLike.articleId = :articleId', { articleId })
      .groupBy('articleLike.reactionType')
      .getRawMany();

    // 閸掓繂顫愰崠鏍ㄥ閺堝『eaction缁鐎锋稉?
    const stats = {
      like: 0,
      love: 0,
      haha: 0,
      wow: 0,
      sad: 0,
      angry: 0,
      dislike: 0,
    };

    // 婵夘偄鍘栫€圭偤妾紒鐔活吀閺佺増宓?
    result.forEach((row) => {
      stats[row.reactionType] = parseInt(row.count, 10);
    });

    return stats;
  }

  /**
   * 閹靛綊鍣洪懢宄板絿婢舵氨鐦掗弬鍥╃彿閻ㄥ墔eaction缂佺喕顓?
   */
  private async getBatchReactionStats(
    articleIds: number[],
  ): Promise<Map<number, { [key: string]: number }>> {
    if (articleIds.length === 0) {
      return new Map();
    }

    // 娴ｈ法鏁ら弫鐗堝祦鎼存捁浠涢崥鍫熺叀鐠囶澁绱濇稉鈧▎鈩冣偓褑骞忛崣鏍ㄥ閺堝鏋冪粩鐘垫畱缂佺喕顓?
    const result = await this.articleLikeRepository
      .createQueryBuilder('articleLike')
      .select('articleLike.articleId', 'articleId')
      .addSelect('articleLike.reactionType', 'reactionType')
      .addSelect('COUNT(*)', 'count')
      .where('articleLike.articleId IN (:...articleIds)', { articleIds })
      .groupBy('articleLike.articleId, articleLike.reactionType')
      .getRawMany();

    // 閺嬪嫬缂撶紒鎾寸亯閺勭姴鐨?
    const statsMap = new Map<number, { [key: string]: number }>();
    
    // 閸掓繂顫愰崠鏍ㄥ閺堝鏋冪粩鐘垫畱缂佺喕顓?
    articleIds.forEach(articleId => {
      statsMap.set(articleId, {
        like: 0,
        love: 0,
        haha: 0,
        wow: 0,
        sad: 0,
        angry: 0,
        dislike: 0,
      });
    });

    // 婵夘偄鍘栫€圭偤妾紒鐔活吀閺佺増宓?
    result.forEach((row) => {
      const articleId = parseInt(row.articleId, 10);
      const stats = statsMap.get(articleId);
      if (stats) {
        stats[row.reactionType] = parseInt(row.count, 10);
      }
    });

    return statsMap;
  }

  /**
   * 閼惧嘲褰囬悽銊﹀煕閻ㄥ嫯銆冮幆鍛礀婢?
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
   * 閼惧嘲褰囬弬鍥╃彿閹碘偓閺堝銆冮幆鍛礀婢?
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
   * 閺嶈宓侀崚鍡欒閺屻儲澹橀弬鍥╃彿
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
   * 閺嶈宓侀弽鍥╊劮閺屻儲澹橀弬鍥╃彿
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
   * 閺嶈宓佹担婊嗏偓鍛叀閹电偓鏋冪粩?
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

    // 閸╄櫣顢呴弶鈥叉閺勭姴鐨犻崳?
    const baseConditionMappers = [
      // 闂堢偟顓搁悶鍡楁喅閸欘亝鐓＄拠銏犲嚒閸欐垵绔烽弬鍥╃彿
      () => !hasPermission && { status: "PUBLISHED" },
      // 閺嶈宓侀崚鍡欒ID閺屻儴顕?
      () => categoryId && { category: { id: categoryId } },
      // 閺嶈宓侀崗鎶芥暛鐠囧秵鐓＄拠?
      () =>
        keyword && {
          title: Like(`%${keyword}%`),
          content: Like(`%${keyword}%`),
          tags: {
            name: Like(`%${keyword}%`),
          },
        },

      // 閺嶈宓佹担婊嗏偓鍖閺屻儴顕?
      () => ({ author: { id: authorId } }),
    ];

    // 閸氬牆鑻熼崺铏诡攨閺夆€叉
    const baseWhereCondition = baseConditionMappers
      .map((mapper) => mapper())
      .filter(Boolean)
      .reduce((acc, curr) => ({ ...acc, ...curr }), {});

    const { page, limit } = pagination;

    // 閹绘劕褰囬崗顒€鍙￠惃鍕叀鐠囥垽鍘ょ純顕嗙礄濞ｈ濮炵憗鍛淬偘閸濅礁鍙ч懕鏃撶礆
    const commonRelations = ["author", "author.userDecorations", "author.userDecorations.decoration", "category", "tags", "downloads"];
    const commonPagination = {
      skip: (page - 1) * limit,
      take: limit,
    };

    let findOptions: FindManyOptions<Article>;

    // 閺嶈宓乼ype缁鐎烽弸鍕紦娑撳秴鎮撻惃鍕叀鐠囥垺娼禒?
    switch (type) {
      case "popular":
        // 閻戭參妫弬鍥╃彿閿涘牊瀵滃ù蹇氼潔闁插繑甯撴惔蹇ョ礆
        // 婵″倹鐏夋稉鈧崨銊ュ敶濞屸剝婀侀弬鍥╃彿閿涘苯鍨稉宥夋閸掕埖妞傞梻纾嬪瘱閸?
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        // 閸忓牆鐨剧拠鏇熺叀鐠囶澀绔撮崨銊ュ敶閻ㄥ嫭鏋冪粩?
        findOptions = {
          where: {
            ...baseWhereCondition,
            createdAt: MoreThan(oneWeekAgo),
          },
          relations: commonRelations,
          order: {
            sort: "DESC" as const,
            views: "DESC",
            createdAt: "DESC" as const,
          },
          ...commonPagination,
        };

        // 濡偓閺屻儰绔撮崨銊ュ敶閺勵垰鎯侀張澶嬫瀮缁旂媴绱濇俊鍌涚亯濞屸剝婀侀崚娆庣瑝闂勬劕鍩楅弮鍫曟？閼煎啫娲?
        const popularTotal = await this.articleRepository.count(findOptions);

        if (popularTotal === 0) {
          // 婵″倹鐏夋稉鈧崨銊ュ敶濞屸剝婀侀弬鍥╃彿閿涘苯鍨弻銉嚄閹碘偓閺堝鏋冪粩?
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
        // 閺堚偓閺傜増鏋冪粩?
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
        // all 閹存牗婀幐鍥х暰type閺冩湹濞囬悽銊╃帛鐠併倖鐓＄拠?
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
   * 閹兼粎鍌ㄩ弬鍥╃彿
   */
  async searchArticles(
    keyword: string,
    pagination: PaginationDto,
    categoryId?: number,
    user?: User,
  ) {
    const { page, limit } = pagination;

    // 濡偓閺屻儳鏁ら幋閿嬫Ц閸氾附婀侀弬鍥╃彿缁狅紕鎮婇弶鍐
    const hasPermission =
      user && PermissionUtil.hasPermission(user, "article:manage");

    // 閺嶈宓侀弶鍐閸愬啿鐣鹃悩鑸碘偓浣规蒋娴?
    const statusCondition = hasPermission
      ? {}
      : { status: "PUBLISHED" as const };

    // 閺嬪嫬缂撻幖婊呭偍閺夆€叉閺佹壆绮?
    const searchConditions: FindOptionsWhere<Article>[] = [
      { title: Like(`%${keyword}%`), ...statusCondition },
      { content: Like(`%${keyword}%`), ...statusCondition },
      { summary: Like(`%${keyword}%`), ...statusCondition },
      { tags: { name: Like(`%${keyword}%`) }, ...statusCondition },
      { category: { name: Like(`%${keyword}%`) }, ...statusCondition },
      { author: { username: Like(`%${keyword}%`) }, ...statusCondition },
    ];

    // 婵″倹鐏夐幓鎰返娴滃棗鍨庣猾绫孌閿涘本鍧婇崝鐘插瀻缁粯娼禒?
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
   * 閼惧嘲褰囬惄绋垮彠閹恒劏宕?
   */
  async findRelatedRecommendations(articleId: number, currentUser?: User) {
    // 妫ｆ牕鍘涘Λ鈧弻銉︽瀮缁旂姵妲搁崥锕€鐡ㄩ崷銊や簰閸欏﹦鏁ら幋閿嬫Ц閸氾附婀侀弶鍐閺屻儳婀?
    const article = await this.articleRepository.findOne({
      where: { id: articleId },
      relations: ["category", "tags", "author", "downloads"],
    });

    if (!article) {
      // 婵″倹鐏夐弬鍥╃彿娑撳秴鐡ㄩ崷顭掔礉閻╁瓨甯存潻鏂挎礀缁岀儤鏆熺紒?
      return ListUtil.buildPaginatedList([], 0, 1, 5);
    }

    // 濡偓閺屻儲娼堥梽鎰剁窗婵″倹鐏夐弬鍥╃彿娑撳秵妲稿鎻掑絺鐢啰濮搁幀浣风瑬閻劍鍩涘▽鈩冩箒缁狅紕鎮婇弶鍐閿涘苯鍨幎娑樺毉瀵倸鐖?
    const hasPermission =
      currentUser &&
      PermissionUtil.hasPermission(currentUser, "article:manage");
    const isAuthor = currentUser && currentUser.id === article.authorId;

    if (article.status !== "PUBLISHED" && !hasPermission && !isAuthor) {
      // 婵″倹鐏夐弬鍥╃彿娑撳秵妲稿鎻掑絺鐢啰濮搁幀浣风瑬閻劍鍩涘▽鈩冩箒閺夊啴妾洪敍宀€娲块幒銉ㄧ箲閸ョ偟鈹栭弫鎵矋
      return ListUtil.buildPaginatedList([], 0, 1, 5);
    }

    // 缂佈呯敾閸樼喐婀侀惃鍕祲閸忚櫕甯归懡鎰扳偓鏄忕帆
    const { category, tags } = article;

    // 绾喕绻?category.id 閸?tag.id 閺勵垱婀侀弫鍫㈡畱閺佹澘鐡?
    const categoryId = category?.id;
    const tagIds = tags
      ?.map((tag) => tag.id)
      .filter((id) => id && !isNaN(Number(id)));

    // 婵″倹鐏夊▽鈩冩箒閺堝鏅ラ惃鍕瀻缁粯鍨ㄩ弽鍥╊劮閿涘矁绻戦崶鐐碘敄閺佹壆绮?
    if (
      (!categoryId || isNaN(Number(categoryId))) &&
      (!tagIds || tagIds.length === 0)
    ) {
      return ListUtil.buildPaginatedList([], 0, 1, 5);
    }

    const whereConditions: FindOptionsWhere<Article> = {
      ...(hasPermission ? {} : { status: "PUBLISHED" }),
      // 閺堫亞娅ヨぐ鏇犳暏閹磋渹绗夐弰鍓с仛閺嶅洩顔囨稉杞扮矌閻ц缍嶉崣顖濐潌閻ㄥ嫬鍨悰銊┿€?
      ...(!currentUser && { listRequireLogin: false }),
      ...(categoryId &&
        !isNaN(Number(categoryId)) && { category: { id: categoryId } }),
      ...(tagIds && tagIds.length > 0 && { tags: { id: In(tagIds) } }),
    };

    // 閸欘亝婀侀崷銊︽箒閺堝鏅ラ弻銉嚄閺夆€叉閺冭埖澧犻幍褑顢戦弻銉嚄
    let relatedArticles: Article[] = [];
    if (Object.keys(whereConditions).length > 0) {
      // 閼惧嘲褰囬惄绋垮彠閺傚洨鐝烽敍灞惧瘻閸掓稑缂撻弮鍫曟？閹烘帒绨敍灞肩喘閸忓牊娓堕弬鐗堟瀮缁?
      const allRelatedArticles = await this.articleRepository.find({
        where: whereConditions,
        relations: ["author", "category", "tags", "downloads"],
        order: {
          createdAt: "DESC", // 娴兼ê鍘涢張鈧弬鐗堟瀮缁?
        },
        take: 30, // 閼惧嘲褰囬弴鏉戭樋閺傚洨鐝烽悽銊ょ艾閺呴缚鍏橀柅澶嬪
      });

      // 鏉╁洦鎶ら幒澶婄秼閸撳秵鏋冪粩?
      const availableArticles = allRelatedArticles.filter(
        (article) => article.id !== articleId,
      );

      // 閺呴缚鍏橀柅澶嬪閺傚洨鐝烽敍姘辩波閸氬牊娓堕弬鐗堚偓褍鎷伴梾蹇旀簚閹?
      if (availableArticles.length > 5) {
        // 鐏忓棙鏋冪粩鐘插瀻娑撶儤娓堕弬鎵矋閸滃苯鍙炬禒鏍矋
        const latestArticles = availableArticles.slice(
          0,
          Math.ceil(availableArticles.length * 0.6),
        ); // 60% 閺堚偓閺傜増鏋冪粩?
        const otherArticles = availableArticles.slice(
          Math.ceil(availableArticles.length * 0.6),
        );

        // 娴犲孩娓堕弬鐗堟瀮缁旂姳鑵戦梾蹇旀簚闁瀚?缁?
        const selectedLatest = this.shuffleArray(latestArticles).slice(0, 3);

        // 娴犲骸鍙炬禒鏍ㄦ瀮缁旂姳鑵戦梾蹇旀簚闁瀚?缁?
        const selectedOthers = this.shuffleArray(otherArticles).slice(0, 2);

        // 閸氬牆鑻熼獮璺哄晙濞嗭繝娈㈤張鐑樺笓鎼村繑娓剁紒鍫㈢波閺?
        relatedArticles = this.shuffleArray([
          ...selectedLatest,
          ...selectedOthers,
        ]);
      } else {
        relatedArticles = availableArticles;
      }

      // 婵″倹鐏夐惄绋垮彠閺傚洨鐝锋稉宥咁檮5缁″浄绱濈悰銉ュ帠娑撯偓娴滄稒娓堕弬鏉挎嫲閻戭參妫弬鍥╃彿
      if (relatedArticles.length < 5) {
        const remainingCount = 5 - relatedArticles.length;
        const existingIds = relatedArticles.map((article) => article.id);

        // 娴兼ê鍘涢懢宄板絿閺堚偓閺傜増鏋冪粩鐘辩稊娑撻缚藟閸?
        const latestArticles = await this.articleRepository.find({
          where: {
            ...(hasPermission ? {} : { status: "PUBLISHED" }),
            // 閺堫亞娅ヨぐ鏇犳暏閹磋渹绗夐弰鍓с仛閺嶅洩顔囨稉杞扮矌閻ц缍嶉崣顖濐潌閻ㄥ嫬鍨悰銊┿€?
            ...(!currentUser && { listRequireLogin: false }),
            id: Not(In([...existingIds, articleId])),
          },
          relations: ["author", "category", "tags", "downloads"],
          order: {
            createdAt: "DESC", // 娴兼ê鍘涢張鈧弬鐗堟瀮缁?
          },
          take: remainingCount * 3, // 閼惧嘲褰囬弴鏉戭樋閻劋绨柅澶嬪
        });

        // 婵″倹鐏夐張鈧弬鐗堟瀮缁旂姳绗夋径鐕傜礉閸愬秷骞忛崣鏍劰闂傘劍鏋冪粩?
        if (latestArticles.length < remainingCount) {
          const popularArticles = await this.articleRepository.find({
            where: {
              ...(hasPermission ? {} : { status: "PUBLISHED" }),
              // 閺堫亞娅ヨぐ鏇犳暏閹磋渹绗夐弰鍓с仛閺嶅洩顔囨稉杞扮矌閻ц缍嶉崣顖濐潌閻ㄥ嫬鍨悰銊┿€?
              ...(!currentUser && { listRequireLogin: false }),
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

          // 閸氬牆鑻熼張鈧弬鐗堟瀮缁旂姴鎷伴悜顓㈡，閺傚洨鐝?
          const allSupplementArticles = [...latestArticles, ...popularArticles];
          const shuffledSupplement = this.shuffleArray(allSupplementArticles);
          relatedArticles = [
            ...relatedArticles,
            ...shuffledSupplement.slice(0, remainingCount),
          ];
        } else {
          // 娴犲孩娓堕弬鐗堟瀮缁旂姳鑵戦梾蹇旀簚闁瀚?
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
      currentUser, // 娴肩娀鈧妽urrentUser閸欏倹鏆?
    );
  }

  /**
   * 婢х偛濮為弬鍥╃彿闂冨懓顕伴柌?
   */
  async incrementViews(id: number) {
    const article = await this.articleRepository.findOne({ where: { id } });
    if (!article) {
      throw new NotFoundException("response.error.articleNotFound");
    }
    return await this.articleRepository.increment({ id: id }, "views", 1);
  }

  /**
   * 閸欐垵绔烽弬鍥╃彿
   */
  async publishArticle(id: number) {
    // 閸忓牐骞忛崣鏍ㄦ瀮缁旂姳淇婇幁顖ょ礉閻劋绨弴瀛樻煀鐠佲剝鏆?
    const article = await this.articleRepository.findOne({
      where: { id },
      relations: ["category", "tags"],
    });

    if (!article) {
      throw new NotFoundException("response.error.articleNotFound");
    }

    // 閸欘亝婀侀棃鐐插絺鐢啰濮搁幀浣烘畱閺傚洨鐝烽幍宥夋付鐟曚礁顤冮崝鐘侯吀閺?
    if (article.status !== 'PUBLISHED') {
      await this.articleRepository.update(id, { status: "PUBLISHED" });

      // 婢х偛濮為崚鍡欒閺傚洨鐝烽弫浼村櫤
      if (article.category) {
        await this.categoryRepository.increment({ id: article.category.id }, "articleCount", 1);
      }

      // 婢х偛濮為弽鍥╊劮閺傚洨鐝烽弫浼村櫤
      if (article.tags && article.tags.length > 0) {
        for (const tag of article.tags) {
          await this.tagRepository.increment({ id: tag.id }, "articleCount", 1);
        }
      }
    }

    return { success: true, message: "response.success.articlePublished" };
  }

  /**
   * 閸欐牗绉烽崣鎴濈閺傚洨鐝?
   */
  async unpublishArticle(id: number) {
    // 閸忓牐骞忛崣鏍ㄦ瀮缁旂姳淇婇幁顖ょ礉閻劋绨弴瀛樻煀鐠佲剝鏆?
    const article = await this.articleRepository.findOne({
      where: { id },
      relations: ["category", "tags"],
    });

    if (!article) {
      throw new NotFoundException("response.error.articleNotFound");
    }

    // 閸欘亝婀侀崣鎴濈閻樿埖鈧胶娈戦弬鍥╃彿閹靛秹娓剁憰浣稿櫤鐏忔垼顓搁弫?
    if (article.status === 'PUBLISHED') {
      await this.articleRepository.update(id, { status: "DRAFT" });

      // 閸戝繐鐨崚鍡欒閺傚洨鐝烽弫浼村櫤
      if (article.category) {
        await this.categoryRepository.decrement({ id: article.category.id }, "articleCount", 1);
      }

      // 閸戝繐鐨弽鍥╊劮閺傚洨鐝烽弫浼村櫤
      if (article.tags && article.tags.length > 0) {
        for (const tag of article.tags) {
          await this.tagRepository.decrement({ id: tag.id }, "articleCount", 1);
        }
      }
    }

    return { success: true, message: "response.success.articleUnpublished" };
  }

  /**
   * 濡偓閺屻儳鏁ら幋閿嬫Ц閸氾箑鍙у▔銊ょ啊娴ｆ粏鈧?
   */
  private async checkUserFollowStatus(
    userId: number,
    authorId: number,
  ): Promise<boolean> {
    try {
      return await this.userService.isFollowing(userId, authorId);
    } catch (error) {
      console.error("濡偓閺屻儱鍙у▔銊ュ彠缁銇戠拹?", error);
      return false;
    }
  }

  /**
   * 濡偓閺屻儳鏁ら幋閿嬫Ц閸氾箑鍑￠弨顖欑帛閺傚洨鐝风拹鍦暏
   */
  private async checkUserPaymentStatus(userId: number, articleId: number) {
    try {
      return await this.orderService.hasPaidForArticle(userId, articleId);
    } catch (error) {
      console.error("濡偓閺屻儲鏁禒妯煎Ц閹礁銇戠拹?", error);
      return false;
    }
  }

  /**
   * 濡偓閺屻儳鏁ら幋铚傜窗閸涙濮搁幀?
   */
  private async checkUserMembershipStatus(user: User) {
    try {
      return (
        user.membershipStatus === "ACTIVE" &&
        user.membershipLevel > 0 &&
        (user.membershipEndDate === null || user.membershipEndDate > new Date())
      );
    } catch (error) {
      console.error("濡偓閺屻儰绱伴崨妯煎Ц閹礁銇戠拹?", error);
      return false;
    }
  }

  /**
   * 娑撹桨缍旈懓鍛潑閸旂姴鐣弫瀵稿Ц閹椒淇婇幁顖ょ礄娴兼艾鎲抽悩鑸碘偓浣告嫲閸忚櫕鏁為悩鑸碘偓渚婄礆
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
   * 娴ｈ法鏁?Fisher-Yates 缁犳纭堕梾蹇旀簚閹垫挷璐￠弫鎵矋
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
   * 閼惧嘲褰囧鎻掑絺鐢啯鏋冪粩鐘垫畱ID閸掓銆?
   */
  async getPublishedArticleIds() {
    const articles = await this.articleRepository.find({
      where: { status: "PUBLISHED" ,listRequireLogin:false},
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

    // 婢跺嫮鎮婇弬鍥╃彿
    return this.processArticleResults(
      likedArticles.map((like) => like.article),
      total,
      pagination.page,
      pagination.limit,
      user,
    );
  }

  /**
   * 鐠佹澘缍嶅ù蹇氼潔閸樺棗褰?
   */
  async recordBrowseHistory(
    userId: number,
    articleId: number,
    recordDto?: RecordBrowseHistoryDto,
  ) {
    // 濡偓閺屻儲鏋冪粩鐘虫Ц閸氾箑鐡ㄩ崷?
    const article = await this.articleRepository.findOne({
      where: { id: articleId },
    });

    if (!article) {
      throw new NotFoundException('response.error.articleNotFound');
    }

    // 閺屻儲澹橀弰顖氭儊瀹稿弶婀佸ù蹇氼潔鐠佹澘缍?
    let browseHistory = await this.browseHistoryRepository.findOne({
      where: { userId, articleId },
    });

    if (browseHistory) {
      // 閺囧瓨鏌婇悳鐗堟箒鐠佹澘缍?
      browseHistory.viewCount += 1;
      if (recordDto?.progress !== undefined) {
        browseHistory.progress = Math.max(browseHistory.progress, recordDto.progress);
      }
      if (recordDto?.duration !== undefined) {
        browseHistory.duration += recordDto.duration;
      }
      browseHistory.updatedAt = new Date();
    } else {
      // 閸掓稑缂撻弬鎷岊唶瑜?
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
   * 閺囧瓨鏌婂ù蹇氼潔鏉╂稑瀹?
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
      // 婵″倹鐏夊▽鈩冩箒鐠佹澘缍嶉敍灞藉灡瀵よ桨绔存稉?
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
   * 閼惧嘲褰囬悽銊﹀煕濞村繗顫嶉崢鍡楀蕉閸掓銆?
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

    // 閺冦儲婀＄粵娑⑩偓?
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

    // 閸掑棛琚粵娑⑩偓?
    if (categoryId) {
      queryBuilder.andWhere('article.categoryId = :categoryId', { categoryId });
    }

    // 閹烘帒绨崪灞藉瀻妞?
    queryBuilder
      .orderBy('browseHistory.updatedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [histories, total] = await queryBuilder.getManyAndCount();

    // 婢跺嫮鎮婇弫鐗堝祦
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
   * 閼惧嘲褰囬崡鏇熸蒋濞村繗顫嶇拋鏉跨秿
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
   * 閸掔娀娅庨崡鏇熸蒋濞村繗顫嶇拋鏉跨秿
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
   * 閹靛綊鍣洪崚鐘绘珟濞村繗顫嶇拋鏉跨秿
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
   * 濞撳懐鈹栭悽銊﹀煕濞村繗顫嶉崢鍡楀蕉
   */
  async clearBrowseHistory(userId: number) {
    await this.browseHistoryRepository.delete({ userId });

    return {
      success: true,
      message: 'response.success.browseHistoryCleared',
    };
  }

  /**
   * 閼惧嘲褰囧ù蹇氼潔缂佺喕顓?
   */
  async getBrowseStats(userId: number) {
    const queryBuilder = this.browseHistoryRepository
      .createQueryBuilder('browseHistory')
      .where('browseHistory.userId = :userId', { userId });

    // 閹粯绁荤憴鍫ｎ唶瑜版洘鏆?
    const totalCount = await queryBuilder.getCount();

    // 閹粯绁荤憴鍫燁偧閺?
    const totalViewsResult = await queryBuilder
      .select('SUM(browseHistory.viewCount)', 'total')
      .getRawOne();
    const totalViews = parseInt(totalViewsResult?.total || '0');

    // 閹浠犻悾娆愭闂€?
    const totalDurationResult = await queryBuilder
      .select('SUM(browseHistory.duration)', 'total')
      .getRawOne();
    const totalDuration = parseInt(totalDurationResult?.total || '0');

    // 娴犲﹥妫╁ù蹇氼潔
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = await this.browseHistoryRepository.count({
      where: {
        userId,
        updatedAt: MoreThanOrEqual(today),
      },
    });

    // 閺堫剙鎳嗗ù蹇氼潔
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    weekAgo.setHours(0, 0, 0, 0);
    const weekCount = await this.browseHistoryRepository.count({
      where: {
        userId,
        updatedAt: MoreThanOrEqual(weekAgo),
      },
    });

    // 閺堫剚婀€濞村繗顫?
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
   * 閼惧嘲褰囬張鈧潻鎴炵セ鐟欏牏娈戦弬鍥╃彿
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

  /**
   * 閺€鎯版閺傚洨鐝?
   */
  async favoriteArticle(articleId: number, userId: number) {
    // 濡偓閺屻儲鏋冪粩鐘虫Ц閸氾箑鐡ㄩ崷?
    const article = await this.articleRepository.findOne({
      where: { id: articleId },
      relations: ['author'],
    });

    if (!article) {
      throw new NotFoundException('response.error.articleNotFound');
    }

    // 濡偓閺屻儲妲搁崥锕€鍑＄紒蹇旀暪閽?
    const existingFavorite = await this.articleFavoriteRepository.findOne({
      where: { userId, articleId },
    });

    if (existingFavorite) {
      throw new BadRequestException('response.error.alreadyFavorited');
    }

    // 閸掓稑缂撻弨鎯版鐠佹澘缍?
    const favorite = this.articleFavoriteRepository.create({
      userId,
      articleId,
    });

    await this.articleFavoriteRepository.save(favorite);

    // 婢х偛濮為弬鍥╃彿閺€鎯版閺?
    await this.articleRepository.increment({ id: articleId }, 'favoriteCount', 1);

    // 鐟欙箑褰傞弨鎯版娴滃娆㈤敍鍫㈡暏娴滃海袧閸掑棛閮寸紒鐔锋嫲闁氨鐓￠敍?
    try {
      // 閺€鎯版閼板懓骞忓妤冃濋崚?
      this.eventEmitter.emit('article.favorited', {
        userId,
        articleId,
        articleTitle: article.title,
      });
      
      // 閺傚洨鐝锋担婊嗏偓鍛板箯瀵版袧閸掑棴绱欐俊鍌涚亯娑撳秵妲搁懛顏勭箒閺€鎯版閼奉亜绻侀惃鍕瀮缁旂媴绱?
      if (article.author?.id && article.author.id !== userId) {
        this.eventEmitter.emit('article.receivedFavorite', {
          authorId: article.author.id,
          articleId,
          favoriterId: userId,
        });
      }
    } catch (error) {
      console.error('鐟欙箑褰傞弨鎯版娴滃娆㈡径杈Е:', error);
    }

    return {
      success: true,
      message: 'response.success.articleFavorited',
      data: {
        favoriteId: favorite.id,
        createdAt: favorite.createdAt,
      },
    };
  }

  /**
   * 閸欐牗绉烽弨鎯版閺傚洨鐝?
   */
  async unfavoriteArticle(articleId: number, userId: number) {
    // 閺屻儲澹橀弨鎯版鐠佹澘缍?
    const favorite = await this.articleFavoriteRepository.findOne({
      where: { userId, articleId },
    });

    if (!favorite) {
      throw new NotFoundException('response.error.favoriteNotFound');
    }

    // 閸掔娀娅庨弨鎯版鐠佹澘缍?
    await this.articleFavoriteRepository.remove(favorite);

    // 閸戝繐鐨弬鍥╃彿閺€鎯版閺?
    await this.articleRepository.decrement({ id: articleId }, 'favoriteCount', 1);

    return {
      success: true,
      message: 'response.success.articleUnfavorited',
    };
  }

  /**
   * 濡偓閺屻儲鏋冪粩鐘虫Ц閸氾箑鍑￠弨鎯版
   */
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
   * 閼惧嘲褰囬悽銊﹀煕閺€鎯版閻ㄥ嫭鏋冪粩鐘插灙鐞?
   */
  async getFavoritedArticles(
    targetUserId: number,
    currentUser: User | undefined,
    pagination: PaginationDto,
  ) {
    const { page, limit } = pagination;

    // 婵″倹鐏夐弻銉嚄閻ㄥ嫪绗夐弰顖濆殰瀹歌京娈戦弨鎯版閿涘矂娓剁憰浣诡梾閺屻儵娈ｇ粔浣筋啎缂?
    if (targetUserId !== currentUser?.id) {
      const targetUserConfig = await this.userConfigRepository.findOne({
        where: { userId: targetUserId },
      });

      // 婵″倹鐏夐悽銊﹀煕鐠佸墽鐤嗘禍鍡涙閽樺繑鏁归挊蹇ョ礉鏉╂柨娲栫粚鍝勫灙鐞?
      if (targetUserConfig?.hideFavorites) {
        return ListUtil.buildPaginatedList([], 0, page, limit);
      }
    }

    const queryBuilder = this.articleFavoriteRepository
      .createQueryBuilder('favorite')
      .leftJoinAndSelect('favorite.article', 'article')
      .leftJoinAndSelect('article.author', 'author')
      .leftJoinAndSelect('author.userDecorations', 'userDecorations')
      .leftJoinAndSelect('userDecorations.decoration', 'decoration')
      .leftJoinAndSelect('article.category', 'category')
      .leftJoinAndSelect('article.tags', 'tags')
      .leftJoinAndSelect('article.downloads', 'downloads')
      .where('favorite.userId = :userId', { userId: targetUserId })
      .andWhere('article.status = :status', { status: 'PUBLISHED' })
      .orderBy('favorite.createdAt', 'DESC');

    const [favorites, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // 閹绘劕褰囬弬鍥╃彿閸掓銆冮獮鑸靛潑閸旂姵鏁归挊蹇旀闂?
    const articles = favorites
      .filter((fav) => fav.article)
      .map((fav) => {
        const article = fav.article;
        (article as any).favoritedAt = fav.createdAt;
        return article;
      });

    // 娴ｈ法鏁ら悳鐗堟箒閻ㄥ嫬顦╅悶鍡樻煙濞?
    return this.processArticleResults(
      articles,
      total,
      page,
      limit,
      currentUser,
    );
  }

  /**
   * 閼惧嘲褰?Telegram 閺傚洣娆㈡稉瀣祰闁剧偓甯?
   */
  async getTelegramDownloadLink(downloadId: number, user: User) {
    const download = await this.downloadRepository.findOne({
      where: { id: downloadId },
      relations: ["article"],
    });

    if (!download) {
      throw new NotFoundException("response.error.downloadNotFound");
    }

    if (download.type !== DownloadType.TELEGRAM) {
      throw new BadRequestException("response.error.onlyTelegramDownloadSupported");
    }

    // 濡偓閺屻儳鏁ら幋閿嬫Ц閸氾附婀侀弶鍐鐠佸潡妫剁拠銉︽瀮缁旂姷娈戞稉瀣祰鐠у嫭绨?
    await this.checkArticleDownloadAccess(download.article, user);

    return this.telegramDownloadService.getFileDownloadUrl(download.url);
  }

  /**
   * 濡偓閺屻儳鏁ら幋閿嬫Ц閸氾附婀侀弶鍐鐠佸潡妫堕弬鍥╃彿閻ㄥ嫪绗呮潪鍊熺カ濠?
   */
  private async checkArticleDownloadAccess(article: Article, user: User) {
    // 閺傚洨鐝锋担婊嗏偓鍛讲娴犮儴顔栭梻?
    if (article.authorId === user.id) {
      return;
    }

    // 缁狅紕鎮婇崨妯哄讲娴犮儴顔栭梻?
    if (PermissionUtil.hasPermission(user, "article:manage")) {
      return;
    }

    // 濡偓閺屻儲鏋冪粩鐘虫Ц閸氾箓娓剁憰浣风帛鐠?
    if (article.viewPrice > 0) {
      // 濡偓閺屻儳鏁ら幋閿嬫Ц閸氾箑鍑＄拹顓濇嫳
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
