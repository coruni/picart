import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, IsNull, FindOptionsWhere, Like, In, Brackets } from "typeorm";
import { InjectQueue } from "@nestjs/bull";
import { Queue } from "bull";
import { CreateCommentDto } from "./dto/create-comment.dto";
import { UpdateCommentDto } from "./dto/update-comment.dto";
import { Comment } from "./entities/comment.entity";
import { CommentLike } from "./entities/comment-like.entity";
import { User } from "../user/entities/user.entity";
import { Article } from "../article/entities/article.entity";
import { UserConfig } from "../user/entities/user-config.entity";
import { Upload } from "../upload/entities/upload.entity";
import { PaginationDto } from "src/common/dto/pagination.dto";
import {
  PermissionUtil,
  sanitizeUser,
  stripScriptTags,
  ListUtil,
  processUserDecorations,
  ImageSerializer,
  ImageObject,
  checkMembershipStatus,
} from "src/common/utils";
import { EnhancedNotificationService } from "../message/enhanced-notification.service";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { ConfigService } from "../config/config.service";
import { UserService } from "../user/user.service";
import { ArticlePresentationService } from "../article/article-presentation.service";
import {
  CommentSortBy,
  QueryArticleCommentsDto,
} from "./dto/query-article-comments.dto";
import { User as UserEntity } from "../user/entities/user.entity";

@Injectable()
export class CommentService {
  private static readonly COMMENT_RELATIONS = [
    "author",
    "author.userDecorations",
    "author.userDecorations.decoration",
    "article",
    "article.category",
    "parent",
    "parent.author",
    "parent.author.userDecorations",
    "parent.author.userDecorations.decoration",
  ] as const;

  constructor(
    @InjectRepository(Comment)
    private commentRepository: Repository<Comment>,
    @InjectRepository(CommentLike)
    private commentLikeRepository: Repository<CommentLike>,
    @InjectRepository(Article)
    private articleRepository: Repository<Article>,
    @InjectRepository(UserConfig)
    private userConfigRepository: Repository<UserConfig>,
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
    @InjectRepository(Upload)
    private uploadRepository: Repository<Upload>,
    private configService: ConfigService,
    @Inject(forwardRef(() => UserService))
    private userService: UserService,
    private articlePresentationService: ArticlePresentationService,
    private readonly enhancedNotificationService: EnhancedNotificationService,
    private eventEmitter: EventEmitter2,
    @InjectQueue('text-audit') private textAuditQueue: Queue,
  ) {}

  private canManagePinnedComment(comment: Comment, currentUser: User) {
    return (
      comment.article?.author?.id === currentUser.id ||
      PermissionUtil.hasPermission(currentUser, "comment:manage") ||
      PermissionUtil.hasPermission(currentUser, "article:manage")
    );
  }

  private canBypassUserVisibility(targetUserId: number, currentUser?: User) {
    if (!currentUser) {
      return false;
    }

    return (
      currentUser.id === targetUserId ||
      PermissionUtil.hasPermission(currentUser, "user:manage")
    );
  }

  private serializeImages(images?: string | string[]): string | null {
    if (!images) {
      return null;
    }
    // 兼容单个字符串和数组，序列化为逗号分隔的存储格式
    const result = ImageSerializer.serialize(images);
    return result || null;
  }

  private deserializeImages(data: string | null): ImageObject[] {
    return ImageSerializer.deserialize(data);
  }

  private async processComment(comment: Comment): Promise<any> {
    const images = await ImageSerializer.processImagesAsync(
      comment.images,
      this.uploadRepository,
      {
        loadingPlaceholder: "/images/loading.png",
        blockedPlaceholder: "/images/blocked.png",
      },
    );
    return {
      ...comment,
      images,
    };
  }

  private processArticleImages(article: any): void {
    if (!article) return;

    // 使用 ImageSerializer 处理图片
    if (article.images) {
      article.images = ImageSerializer.processImages(article.images);
    } else {
      article.images = [];
    }
  }

  private hasCommentFullArticleAccess(article: any, currentUser?: User) {
    if (!article || !currentUser) {
      return false;
    }

    return (
      article.author?.id === currentUser.id ||
      PermissionUtil.hasPermission(currentUser, "article:manage")
    );
  }

  private processArticlePermissionsForComment(
    article: any,
    currentUser?: User,
    freeImagesCount: number = 3,
  ): void {
    if (!article) return;

    this.processArticleImages(article);

    if (this.hasCommentFullArticleAccess(article, currentUser)) {
      return;
    }

    if (article.images && Array.isArray(article.images)) {
      article.images = article.images.slice(0, freeImagesCount);
    }
  }

  private async processCommentData(
    comment: any,
    currentUser?: User,
    freeImagesCount: number = 3,
    blockedUserIds?: Set<number>,
  ): Promise<any> {
    if (comment.article) {
      this.processArticlePermissionsForComment(
        comment.article,
        currentUser,
        freeImagesCount,
      );
    }

    const isBlocked = comment.author?.id
      ? blockedUserIds?.has(comment.author.id) || false
      : false;

    const processedAuthor = comment.author
      ? sanitizeUser({
          ...processUserDecorations(comment.author),
          isMember: checkMembershipStatus(comment.author),
          isBlocked,
        })
      : null;

    const isParentBlocked = comment.parent?.author?.id
      ? blockedUserIds?.has(comment.parent.author.id) || false
      : false;

    const processedParent = comment.parent
      ? {
          ...comment.parent,
          author: comment.parent.author
            ? sanitizeUser({
                ...processUserDecorations(comment.parent.author),
                isMember: checkMembershipStatus(comment.parent.author),
                isBlocked: isParentBlocked,
              })
            : null,
        }
      : null;

    return {
      ...(await this.processComment(comment)),
      author: processedAuthor,
      parent: processedParent,
      parentId: comment.parent?.id || null,
      rootId: comment.rootId || comment.id,
      floor: comment.floor || null,
    };
  }

  private async getCommentFreeImagesCount(comments: any[], currentUser?: User) {
    if (comments.length === 0) {
      return 3;
    }

    const needsRestriction = comments.some(
      (comment) =>
        comment.article &&
        !this.hasCommentFullArticleAccess(comment.article, currentUser),
    );

    if (!needsRestriction) {
      return 3;
    }

    return this.configService.getArticleFreeImagesCount();
  }

  private async processCommentList(comments: any[], currentUser?: User) {
    const freeImagesCount = await this.getCommentFreeImagesCount(
      comments,
      currentUser,
    );

    // 批量获取所有相关用户的拉黑状态
    const allUserIds = new Set<number>();
    comments.forEach((comment) => {
      if (comment.author?.id) allUserIds.add(comment.author.id);
      if (comment.parent?.author?.id) allUserIds.add(comment.parent.author.id);
    });

    const blockedUserIds = currentUser
      ? await this.userService.getBlockedUserIdSet(
          currentUser.id,
          Array.from(allUserIds),
        )
      : new Set<number>();

    return Promise.all(
      comments.map((comment) =>
        this.processCommentData(
          comment,
          currentUser,
          freeImagesCount,
          blockedUserIds,
        ),
      ),
    );
  }

  private async getLikedCommentIdSet(commentIds: number[], currentUser?: User) {
    if (!currentUser || commentIds.length === 0) {
      return new Set<number>();
    }

    const likes = await this.commentLikeRepository.find({
      where: {
        userId: currentUser.id,
        commentId: In(commentIds),
      },
      select: ["commentId"],
    });

    return new Set(likes.map((like) => like.commentId));
  }

  private async getAuthorLikedCommentIdSet(
    commentIds: number[],
    articleAuthorId?: number,
  ) {
    if (!articleAuthorId || commentIds.length === 0) {
      return new Set<number>();
    }

    const likes = await this.commentLikeRepository.find({
      where: {
        userId: articleAuthorId,
        commentId: In(commentIds),
      },
      select: ["commentId"],
    });

    return new Set(likes.map((like) => like.commentId));
  }

  private buildCommentOrder(sortBy: CommentSortBy) {
    switch (sortBy) {
      case CommentSortBy.OLDEST:
        return {
          isPinned: "DESC" as const,
          pinnedAt: "DESC" as const,
          createdAt: "ASC" as const,
        };
      case CommentSortBy.HOT:
        return {
          isPinned: "DESC" as const,
          pinnedAt: "DESC" as const,
          likes: "DESC" as const,
          replyCount: "DESC" as const,
          createdAt: "DESC" as const,
        };
      case CommentSortBy.LATEST:
      default:
        return {
          isPinned: "DESC" as const,
          pinnedAt: "DESC" as const,
          createdAt: "DESC" as const,
        };
    }
  }

  async createComment(createCommentDto: CreateCommentDto, user: User) {
    const { articleId, parentId, images, ...commentData } = createCommentDto;
    if (commentData.content !== undefined) {
      commentData.content = stripScriptTags(commentData.content) || "";
    }

    // 检查是否需要审核
    const needAudit = await this.configService.getCachedConfig('content_audit_comment_enabled', false);
    const initialStatus = needAudit === true ? 'PENDING' : 'PUBLISHED';

    const savedComment = await this.commentRepository.manager.transaction(
      async (manager) => {
        const articleRepository = manager.getRepository(Article);
        const commentRepository = manager.getRepository(Comment);

        const article = await articleRepository
          .createQueryBuilder("article")
          .setLock("pessimistic_write")
          .leftJoinAndSelect("article.author", "author")
          .where("article.id = :articleId", { articleId })
          .getOne();

        if (!article) {
          throw new Error("文章不存在");
        }

        const comment = commentRepository.create({
          ...commentData,
          images: this.serializeImages(images) || "",
          author: user,
          article,
          status: initialStatus,
        });

        if (parentId) {
          const parent = await commentRepository.findOne({
            where: { id: parentId },
            relations: ["article", "author"],
          });

          if (!parent || parent.article.id !== articleId) {
            throw new Error("父评论不属于该文章");
          }

          comment.parent = parent;
          comment.rootId = parent.rootId || parent.id;
          comment.floor = parent.floor || 0;
          parent.replyCount += 1;
          await commentRepository.save(parent);
        } else {
          const rawFloor = await commentRepository
            .createQueryBuilder("comment")
            .select("COALESCE(MAX(comment.floor), 0)", "maxFloor")
            .where("comment.articleId = :articleId", { articleId })
            .andWhere("comment.parentId IS NULL")
            .getRawOne<{ maxFloor: string }>();

          comment.floor = Number(rawFloor?.maxFloor || 0) + 1;
        }

        const saved = await commentRepository.save(comment);
        await articleRepository.increment({ id: articleId }, "commentCount", 1);

        return saved;
      },
    );

    // 如果需要审核，添加到队列（不等待，避免阻塞）
    if (needAudit === true) {
      this.textAuditQueue.add(
        {
          type: 'comment',
          id: savedComment.id,
          content: commentData.content,
          userId: user.id,
          images: Array.isArray(images) ? images : [],
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      ).catch((error) => {
        console.error('添加评论审核任务失败:', error);
      });
    }

    try {
      await this.articlePresentationService.invalidateHotArticleCache();
    } catch (error) {
      console.error("更新文章评论数失败", error);
    }

    const article = await this.articleRepository.findOne({
      where: { id: articleId },
      relations: ["author"],
    });

    const savedCommentWithRelations = await this.commentRepository.findOne({
      where: { id: savedComment.id },
      relations: [...CommentService.COMMENT_RELATIONS],
    });

    try {
      this.eventEmitter.emit("comment.created", {
        userId: user.id,
        userName: user.nickname || user.username,
        articleId,
        articleTitle: article?.title,
        commentId: savedComment.id,
        commentContent: commentData.content,
        authorId: article?.author?.id,
        parentCommentId: parentId,
        parentAuthorId: savedCommentWithRelations?.parent?.author?.id,
      });

      // 触发文章被评论事件（作者获得积分）
      this.eventEmitter.emit("article.receivedComment", {
        authorId: article?.author?.id,
        articleId,
        commenterId: user.id,
        commentId: savedComment.id,
      });
    } catch (error) {
      console.error("触发评论事件失败:", error);
    }

    return {
      success: true,
      message: "response.success.commentCreate",
      data: savedCommentWithRelations
        ? await this.addParentAndRootId(savedCommentWithRelations, user)
        : await this.processComment(savedComment),
    };
  }

  async findAllComments(
    pagination: PaginationDto,
    articleId?: number,
    userId?: number,
    keyword?: string,
  ) {
    const { page, limit } = pagination;

    const where: FindOptionsWhere<Comment> = {
      status: 'PUBLISHED',
      ...(articleId && { article: { id: articleId } }),
      ...(userId && { author: { id: userId } }),
      ...(keyword && { content: Like(`%${keyword}%`) }),
    };

    const [comments, total] = await this.commentRepository.findAndCount({
      where,
      relations: [...CommentService.COMMENT_RELATIONS],
      order: { createdAt: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
    });

    const processedComments = await this.processCommentList(comments);

    return ListUtil.buildPaginatedList(processedComments, total, page, limit);
  }

  private async addParentAndRootId(
    comment: any,
    currentUser?: User,
  ): Promise<any> {
    const [processedComment] = await this.processCommentList(
      [comment],
      currentUser,
    );
    return processedComment;
  }

  async findCommentsByArticle(
    articleId: number,
    query: QueryArticleCommentsDto,
    currentUser?: User,
  ) {
    const {
      page,
      limit,
      sortBy = CommentSortBy.LATEST,
      onlyAuthor = false,
    } = query;

    const article = await this.articleRepository.findOne({
      where: { id: articleId },
      relations: ["author"],
    });
    if (!article) {
      throw new NotFoundException("response.error.articleNotFound");
    }

    const [comments, total] = await this.commentRepository.findAndCount({
      where: [
        {
          article: { id: articleId },
          parent: IsNull(),
          status: "PUBLISHED",
          ...(onlyAuthor ? { author: { id: article.author.id } } : {}),
        },
        ...(currentUser
          ? [
              {
                article: { id: articleId },
                parent: IsNull(),
                status: "PENDING" as const,
                author: { id: currentUser.id },
                ...(onlyAuthor ? { author: { id: article.author.id } } : {}),
              },
            ]
          : []),
      ],
      relations: [...CommentService.COMMENT_RELATIONS],
      order: this.buildCommentOrder(sortBy),
      skip: (page - 1) * limit,
      take: limit,
    });

    const parentIds = comments.map((comment) => comment.id);
    const replies = parentIds.length
      ? await this.commentRepository.find({
          where: [
            {
              parent: { id: In(parentIds) },
              status: "PUBLISHED",
            },
            {
              rootId: In(parentIds),
              status: "PUBLISHED",
            },
            ...(currentUser
              ? [
                  {
                    parent: { id: In(parentIds) },
                    status: "PENDING" as const,
                    author: { id: currentUser.id },
                  },
                  {
                    rootId: In(parentIds),
                    status: "PENDING" as const,
                    author: { id: currentUser.id },
                  },
                ]
              : []),
          ],
          relations: [...CommentService.COMMENT_RELATIONS],
          order: this.buildCommentOrder(sortBy),
        })
      : [];

    const allCommentIds = [...parentIds, ...replies.map((reply) => reply.id)];
    const [processedParents, processedReplies, likedCommentIds, authorLikedIds] =
      await Promise.all([
        this.processCommentList(comments, currentUser),
        this.processCommentList(replies, currentUser),
        this.getLikedCommentIdSet(allCommentIds, currentUser),
        this.getAuthorLikedCommentIdSet(allCommentIds, article.author.id),
      ]);

    const repliesByParentId = new Map<number, any[]>();
    for (const reply of processedReplies) {
      const topParentId = reply.rootId || reply.parentId;
      if (!topParentId) {
        continue;
      }

      const groupedReplies = repliesByParentId.get(topParentId) || [];
      if (groupedReplies.length < 5) {
        groupedReplies.push({
          ...reply,
          isLiked: likedCommentIds.has(reply.id),
          isAuthorLiked: authorLikedIds.has(reply.id),
        });
      }
      repliesByParentId.set(topParentId, groupedReplies);
    }

    const commentsWithReplies = processedParents.map((parent) => ({
      ...parent,
      isLiked: likedCommentIds.has(parent.id),
      isAuthorLiked: authorLikedIds.has(parent.id),
      replies: repliesByParentId.get(parent.id) || [],
    }));

    return ListUtil.buildPaginatedList(commentsWithReplies, total, page, limit);
  }

  async findCommentDetail(
    id: number,
    query: QueryArticleCommentsDto,
    currentUser?: User,
  ) {
    const {
      page,
      limit,
      sortBy = CommentSortBy.LATEST,
      onlyAuthor = false,
    } = query;
    const comment = await this.commentRepository.findOne({
      where: [
        { id, status: "PUBLISHED" },
        ...(currentUser ? [{ id, status: "PENDING" as const, author: { id: currentUser.id } }] : []),
      ],
      relations: [...CommentService.COMMENT_RELATIONS, "article.author"],
    });

    if (!comment) {
      throw new NotFoundException("response.error.commentNotFound");
    }

    const rootId = comment.rootId || comment.id;

    const [replies, totalReplies] = await this.commentRepository.findAndCount({
      where: [
        {
          rootId,
          status: "PUBLISHED",
          ...(onlyAuthor ? { author: { id: comment.article.author.id } } : {}),
        },
        ...(currentUser
          ? [
              {
                rootId,
                status: "PENDING" as const,
                author: { id: currentUser.id },
                ...(onlyAuthor ? { author: { id: comment.article.author.id } } : {}),
              },
            ]
          : []),
      ],
      relations: [...CommentService.COMMENT_RELATIONS],
      order: this.buildCommentOrder(sortBy),
      skip: (page - 1) * limit,
      take: limit,
    });

    const commentIds = replies.map((reply) => reply.id);
    const [userLikedCommentIds, authorLikedCommentIds] = await Promise.all([
      this.getLikedCommentIdSet(commentIds, currentUser),
      this.getAuthorLikedCommentIdSet(commentIds, comment.article.author.id),
    ]);
    const processedReplies = (
      await this.processCommentList(replies, currentUser)
    ).map((reply) => ({
      ...reply,
      isLiked: userLikedCommentIds.has(reply.id),
      isAuthorLiked: authorLikedCommentIds.has(reply.id),
    }));

    return ListUtil.buildPaginatedList(
      processedReplies,
      totalReplies,
      page,
      limit,
    );
  }

  async updateComment(
    id: number,
    updateCommentDto: UpdateCommentDto,
    currentUser: User,
  ) {
    const comment = await this.commentRepository.findOne({
      where: { id },
      relations: ["article", "article.author", "author"],
    });

    if (!comment) {
      throw new NotFoundException("response.error.commentNotFound");
    }

    const canEditContent =
      comment.author.id === currentUser.id ||
      PermissionUtil.hasPermission(currentUser, "comment:manage");
    const canManagePin = this.canManagePinnedComment(comment, currentUser);
    const wantsToEditContent = updateCommentDto.content !== undefined;
    const wantsToEditImages = updateCommentDto.images !== undefined;

    if ((wantsToEditContent || wantsToEditImages) && !canEditContent) {
      throw new ForbiddenException("response.error.noPermission");
    }

    if (
      updateCommentDto.isPinned !== undefined &&
      !canManagePin
    ) {
      throw new ForbiddenException("response.error.noPermission");
    }

    const { content, images, isPinned } = updateCommentDto;
    if (content !== undefined) {
      comment.content = stripScriptTags(content) || "";
    }
    if (images !== undefined) {
      comment.images = this.serializeImages(images) || "";
    }
    if (isPinned !== undefined) {
      comment.isPinned = isPinned;
      comment.pinnedAt = isPinned ? new Date() : null;
    }

    const updatedComment = await this.commentRepository.save(comment);

    const updatedCommentWithRelations = await this.commentRepository.findOne({
      where: { id: updatedComment.id },
      relations: [...CommentService.COMMENT_RELATIONS],
    });

    return {
      success: true,
      message: "response.success.commentUpdate",
      data: updatedCommentWithRelations
        ? await this.addParentAndRootId(updatedCommentWithRelations, currentUser)
        : await this.processComment(updatedComment),
    };
  }

  async removeComment(id: number, currentUser: User) {
    const comment = await this.commentRepository.findOne({
      where: { id },
      relations: ["author", "article", "article.author", "parent"],
    });

    if (!comment) {
      throw new NotFoundException("response.error.commentNotFound");
    }

    const canDelete =
      comment.author.id === currentUser.id ||
      comment.article.author.id === currentUser.id ||
      PermissionUtil.hasPermission(currentUser, "comment:manage");

    if (!canDelete) {
      throw new ForbiddenException("response.error.noPermission");
    }

    if (comment.parent) {
      comment.parent.replyCount = Math.max(0, comment.parent.replyCount - 1);
      await this.commentRepository.save(comment.parent);
    }

    try {
      await this.articleRepository.increment(
        { id: comment.article.id },
        "commentCount",
        -1,
      );
      await this.articlePresentationService.invalidateHotArticleCache();

      const updatedArticle = await this.articleRepository.findOne({
        where: { id: comment.article.id },
      });
      if (updatedArticle && updatedArticle.commentCount < 0) {
        await this.articleRepository.update(comment.article.id, {
          commentCount: 0,
        });
      }
    } catch (error) {
      console.error("更新文章评论数失败", error);
    }

    await this.commentRepository.remove(comment);
    return { success: true, message: "response.success.commentDelete" };
  }

  async like(id: number, user: User) {
    const comment = await this.commentRepository.findOne({
      where: { id },
      relations: ["author", "article"],
    });

    if (!comment) {
      throw new NotFoundException("response.error.commentNotFound");
    }

    const existingLike = await this.commentLikeRepository.findOne({
      where: {
        commentId: id,
        userId: user.id,
      },
    });

    if (existingLike) {
      await this.commentLikeRepository.remove(existingLike);
      await this.commentRepository.decrement({ id }, "likes", 1);
      if (comment.author?.id && comment.author.id !== user.id) {
        await this.userRepository.decrement(
          { id: comment.author.id },
          "likes",
          1,
        );
      }

      return {
        success: true,
        message: "response.success.commentUnlike",
        data: { isLiked: false },
      };
    }

    const like = this.commentLikeRepository.create({
      commentId: id,
      userId: user.id,
    });
    await this.commentLikeRepository.save(like);
    await this.commentRepository.increment({ id }, "likes", 1);
    if (comment.author?.id && comment.author.id !== user.id) {
      await this.userRepository.increment(
        { id: comment.author.id },
        "likes",
        1,
      );
    }

    try {
      this.eventEmitter.emit("comment.liked", {
        userId: user.id,
        userName: user.nickname || user.username,
        commentId: id,
        commentContent: comment.content,
        authorId: comment.author?.id,
        articleId: comment.article?.id,
      });
      if (comment.author?.id && comment.author.id !== user.id) {
        this.eventEmitter.emit("comment.receivedLike", {
          authorId: comment.author.id,
          commentId: id,
          likerId: user.id,
        });
      }
    } catch (error) {
      console.error("触发点赞事件失败:", error);
    }

    return {
      success: true,
      message: "response.success.commentLike",
      data: { isLiked: true },
    };
  }

  async getCommentCount(articleId: number) {
    return await this.commentRepository.count({
      where: {
        article: { id: articleId },
        status: "PUBLISHED",
      },
    });
  }

  async getUserComments(
    userId: number,
    pagination: PaginationDto,
    currentUser?: User,
  ) {
    const { page, limit } = pagination;

    if (!this.canBypassUserVisibility(userId, currentUser)) {
      const targetUserConfig = await this.userConfigRepository.findOne({
        where: { userId },
      });

      if (targetUserConfig?.hideComments) {
        return ListUtil.buildPaginatedList([], 0, page, limit);
      }
    }

    const [data, total] = await this.commentRepository.findAndCount({
      where: [
        {
          author: { id: userId },
          status: "PUBLISHED",
        },
        ...(currentUser && currentUser.id === userId
          ? [
              {
                author: { id: userId },
                status: "PENDING" as const,
              },
            ]
          : []),
      ],
      relations: [...CommentService.COMMENT_RELATIONS],
      order: {
        createdAt: "DESC" as const,
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    const processedData = await this.processCommentList(data, currentUser);

    return ListUtil.fromFindAndCount([processedData, total], page, limit);
  }

  async findByArticleId(articleId: number) {
    const comments = await this.commentRepository.find({
      where: {
        article: { id: articleId },
        status: "PUBLISHED",
      },
      relations: [...CommentService.COMMENT_RELATIONS],
      order: {
        createdAt: "DESC",
      },
    });

    return this.processCommentList(comments);
  }

  async getPopularComments(articleId: number, limit: number = 5) {
    const comments = await this.commentRepository.find({
      where: {
        article: { id: articleId },
        status: "PUBLISHED",
      },
      relations: [...CommentService.COMMENT_RELATIONS],
      order: {
        createdAt: "DESC",
      },
      take: limit,
    });

    return this.processCommentList(comments);
  }

  async setCommentPin(id: number, isPinned: boolean, currentUser: User) {
    const comment = await this.commentRepository.findOne({
      where: { id },
      relations: ["article", "article.author"],
    });

    if (!comment) {
      throw new NotFoundException("response.error.commentNotFound");
    }
    if (!this.canManagePinnedComment(comment, currentUser)) {
      throw new ForbiddenException("response.error.noPermission");
    }

    comment.isPinned = isPinned;
    comment.pinnedAt = isPinned ? new Date() : null;
    await this.commentRepository.save(comment);

    return {
      success: true,
      message: "response.success.commentUpdate",
      data: {
        id: comment.id,
        isPinned: comment.isPinned,
        pinnedAt: comment.pinnedAt,
      },
    };
  }
}
