import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, IsNull, FindOptionsWhere, Like, In } from "typeorm";
import { CreateCommentDto } from "./dto/create-comment.dto";
import { UpdateCommentDto } from "./dto/update-comment.dto";
import { Comment } from "./entities/comment.entity";
import { CommentLike } from "./entities/comment-like.entity";
import { User } from "../user/entities/user.entity";
import { Article } from "../article/entities/article.entity";
import { PaginationDto } from "src/common/dto/pagination.dto";
import { PermissionUtil, sanitizeUser, ListUtil, processUserDecorations } from "src/common/utils";
import { EnhancedNotificationService } from "../message/enhanced-notification.service";
import { EventEmitter2 } from "@nestjs/event-emitter";

@Injectable()
export class CommentService {
  constructor(
    @InjectRepository(Comment)
    private commentRepository: Repository<Comment>,
    @InjectRepository(CommentLike)
    private commentLikeRepository: Repository<CommentLike>,
    @InjectRepository(Article)
    private articleRepository: Repository<Article>,
    private readonly enhancedNotificationService: EnhancedNotificationService,
    private eventEmitter: EventEmitter2,
  ) {}

  /**
   * 序列化图片数组为逗号分隔的字符串
   */
  private serializeImages(images?: string[]): string | null {
    if (!images || images.length === 0) {
      return null;
    }
    return images.join(',');
  }

  /**
   * 反序列化逗号分隔的字符串为图片数组
   */
  private deserializeImages(images: string | null): string[] {
    if (!images) {
      return [];
    }
    
    return images
      .split(',')
      .map(url => url.trim())
      .filter(url => url.length > 0);
  }

  /**
   * 处理评论对象，反序列化images字段
   */
  private processComment(comment: Comment): any {
    return {
      ...comment,
      images: this.deserializeImages(comment.images),
    };
  }

  /**
   * 处理文章的 images 字段，转换为数组
   */
  private processArticleImages(article: any): void {
    if (!article) return;
    
    if (article.images) {
      if (typeof article.images === "string") {
        article.images = article.images
          .split(",")
          .filter((img: string) => img.trim() !== "");
      }
    } else {
      article.images = [];
    }
  }

  /**
   * 创建评论
   */
  async createComment(createCommentDto: CreateCommentDto, user: User) {
    const { articleId, parentId, images, ...commentData } = createCommentDto;

    // 查找文章
    const article = await this.articleRepository.findOne({
      where: { id: articleId },
      relations: ["author"],
    });
    if (!article) {
      throw new Error("文章不存在");
    }

    // 创建评论，序列化images
    const comment = this.commentRepository.create({
      ...commentData,
      images: this.serializeImages(images) || '',
      author: user,
      article,
      status: "PUBLISHED",
    });

    // 如果是回复评论
    if (parentId) {
      const parent = await this.commentRepository.findOne({
        where: { id: parentId },
        relations: ["article"],
      });

      if (parent?.article.id !== articleId) {
        throw new Error("父评论不属于该文章");
      }

      comment.parent = parent;
      // 设置 rootId：如果父评论有 rootId 就用父评论的，否则用父评论的 id
      comment.rootId = parent.rootId || parent.id;
      parent.replyCount += 1;
      await this.commentRepository.save(parent);
    }

    const savedComment = await this.commentRepository.save(comment);

    // 更新文章评论数（只有顶级评论才增加文章的评论数）
    if (!parentId) {
      try {
        await this.articleRepository.increment({ id: articleId }, "commentCount", 1);
      } catch (error) {
        console.error("更新文章评论数失败:", error);
      }
    }

    // 触发评论事件（用于装饰品活动进度和积分系统）
    try {
      this.eventEmitter.emit('comment.created', { 
        userId: user.id, 
        userName: user.nickname || user.username,
        articleId, 
        articleTitle: article.title,
        commentId: savedComment.id,
        commentContent: commentData.content,
        authorId: article.author.id,
        parentCommentId: parentId,
        parentAuthorId: parentId ? (await this.commentRepository.findOne({
          where: { id: parentId },
          relations: ["author"],
        }))?.author.id : undefined,
      });
    } catch (error) {
      console.error("触发评论事件失败:", error);
    }

    return {
      success: true,
      message: "response.success.commentCreate",
      data: this.processComment(savedComment),
    };
  }

  /**
   * 获取全部评论
   */
  async findAllComments(
    pagination: PaginationDto,
    articleId?: number,
    userId?: number,
    keyword?: string,
  ) {
    const { page, limit } = pagination;

    const where: FindOptionsWhere<Comment> = {
      ...(articleId && { article: { id: articleId } }),
      ...(userId && { author: { id: userId } }),
      ...(keyword && { content: Like(`%${keyword}%`) }),
    };

    const [comments, total] = await this.commentRepository.findAndCount({
      where,
      relations: ["author", "author.userDecorations", "author.userDecorations.decoration", "article", "parent", "parent.author"],
      select: {
        author: {
          id: true,
          username: true,
          nickname: true,
          avatar: true,
          status: true,
          membershipLevel: true,
          membershipEndDate: true,
          membershipLevelName: true,
          membershipStartDate: true,
          membershipStatus: true,
          createdAt: true,
          updatedAt: true,
        },
        article: {
          id: true,
          title: true,
          cover: true,
          views: true,
          summary: true,
          content: true,
          images: true,
          likes: true,
          viewPrice: true,
          requireFollow: true,
          requireLogin: true,
          requireMembership: true,
          requirePayment: true,
          updatedAt: true,
          createdAt: true,
        },
        parent: {
          id: true,
          author: {
            id: true,
            username: true,
            nickname: true,
            avatar: true,
          },
        },
      },
      order: { createdAt: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
    });

    const proessedComments = await Promise.all(
      comments.map(async (comment) => {
        const isMember = await this.checkUserMembershipStatus(comment.author);
        // 处理文章图片
        this.processArticleImages(comment.article);
        
        // 构建回复目标信息
        const replyTo = comment.parent ? {
          commentId: comment.parent.id,
          content: comment.parent.content,
          author: {
            id: comment.parent.author.id,
            username: comment.parent.author.username,
            nickname: comment.parent.author.nickname,
            avatar: comment.parent.author.avatar,
          },
        } : null;
        
        return {
          ...this.processComment(comment),
          author: sanitizeUser({
            ...processUserDecorations(comment.author),
            isMember,
          }),
          replyTo,
          parentId: comment.parent?.id || null,
          rootId: comment.rootId || comment.id,
        };
      }),
    );

    return ListUtil.buildPaginatedList(proessedComments, total, page, limit);
  }

  /**
   * 辅助函数：补充 parentId 和 rootId 字段，并处理装饰品
   */
  private addParentAndRootId(comment: any): any {
    const parentId = comment.parent ? comment.parent.id : null;
    // 优先使用数据库中的 rootId，如果没有则计算
    const rootId =
      comment.rootId ||
      (parentId ? (comment.parent.rootId ?? comment.parent.id) : comment.id);
    
    // 处理作者装饰品
    const processedAuthor = comment.author ? sanitizeUser(processUserDecorations(comment.author)) : null;
    const processedParentAuthor = comment.parent?.author ? sanitizeUser(processUserDecorations(comment.parent.author)) : null;
    
    // 构建回复目标信息（包含被回复评论的内容）
    const replyTo = comment.parent ? {
      commentId: comment.parent.id,
      content: comment.parent.content,
      author: {
        id: comment.parent.author.id,
        username: comment.parent.author.username,
        nickname: comment.parent.author.nickname,
        avatar: comment.parent.author.avatar,
      },
    } : null;
    
    return {
      ...this.processComment(comment),
      author: processedAuthor,
      replyTo, // 添加回复目标信息（包含评论内容）
      parent: comment.parent
        ? {
            id: comment.parent.id,
            author: processedParentAuthor,
          }
        : null,
      parentId,
      rootId,
    };
  }

  /**
   * 分页查询文章的评论
   */
  async findCommentsByArticle(articleId: number, pagination: PaginationDto, currentUser?: User) {
    const { page, limit } = pagination;

    // 验证文章是否存在
    const article = await this.articleRepository.findOne({
      where: { id: articleId },
    });
    if (!article) {
      throw new NotFoundException("response.error.articleNotFound");
    }

    // 只查父评论（不查 replies），添加装饰品关联
    const [comments, total] = await this.commentRepository.findAndCount({
      where: {
        article: { id: articleId },
        parent: IsNull(),
        status: "PUBLISHED",
      },
      relations: ["author", "author.userDecorations", "author.userDecorations.decoration", "article"],
      select: {
        article: {
          id: true,
          title: true,
          cover: true,
          views: true,
          likes: true,
          viewPrice: true,
          requireFollow: true,
          requireLogin: true,
          requireMembership: true,
          requirePayment: true,
          updatedAt: true,
          createdAt: true,
        },
      },

      order: {
        createdAt: "DESC",
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    // 查询用户点赞状态
    let userLikedCommentIds: Set<number> = new Set();
    if (currentUser) {
      const commentIds = comments.map((comment) => comment.id);
      const userLikes = await this.commentLikeRepository.find({
        where: {
          userId: currentUser.id,
          commentId: In(commentIds),
        },
      });
      userLikedCommentIds = new Set(userLikes.map((like) => like.commentId));
    }

    // 对每个父评论，查前5条子评论，并补充 parentId/rootId
    const commentsWithReplies = await Promise.all(
      comments.map(async (parent) => {
        const replies = await this.commentRepository.find({
          where: { parent: { id: parent.id }, status: "PUBLISHED" },
          relations: ["author", "author.userDecorations", "author.userDecorations.decoration", "parent", "parent.author", "parent.author.userDecorations", "parent.author.userDecorations.decoration", "article"],
          select: {
            article: {
              id: true,
              title: true,
              cover: true,
              views: true,
              likes: true,
              viewPrice: true,
              requireFollow: true,
              requireLogin: true,
              requireMembership: true,
              requirePayment: true,
              updatedAt: true,
              createdAt: true,
            },
          },

          order: { createdAt: "ASC" },
          take: 5,
        });

        // 查询子评论的点赞状态
        let replyLikedIds: Set<number> = new Set();
        if (currentUser && replies.length > 0) {
          const replyIds = replies.map((reply) => reply.id);
          const replyLikes = await this.commentLikeRepository.find({
            where: {
              userId: currentUser.id,
              commentId: In(replyIds),
            },
          });
          replyLikedIds = new Set(replyLikes.map((like) => like.commentId));
        }

        return {
          ...this.addParentAndRootId(parent),
          isLiked: userLikedCommentIds.has(parent.id),
          replies: replies.map((reply) => ({
            ...this.addParentAndRootId(reply),
            isLiked: replyLikedIds.has(reply.id),
          })),
        };
      }),
    );

    const proessedCommentsWithReplies = await Promise.all(
      commentsWithReplies.map(async (comment) => {
        const isMember = await this.checkUserMembershipStatus(comment.author);
        // 处理文章图片
        this.processArticleImages(comment.article);
        return {
          ...comment,
          author: sanitizeUser({ ...processUserDecorations(comment.author), isMember }),
          replies: await Promise.all(
            comment.replies.map(async (reply) => {
              const replyIsMember = await this.checkUserMembershipStatus(reply.author);
              // 处理回复中的文章图片
              this.processArticleImages(reply.article);
              return {
                ...reply,
                author: sanitizeUser({ ...processUserDecorations(reply.author), isMember: replyIsMember }),
                parent: reply.parent ? {
                  ...reply.parent,
                  author: sanitizeUser(processUserDecorations(reply.parent.author)),
                } : null,
              };
            })
          ),
        };
      }),
    );

    return ListUtil.buildPaginatedList(
      proessedCommentsWithReplies,
      total,
      page,
      limit,
    );
  }

  /**
   * 查询评论详情（包含分页的回复）
   */
  async findCommentDetail(id: number, pagination: PaginationDto, currentUser?: User) {
    const { page, limit } = pagination;
    const comment = await this.commentRepository.findOne({
      where: { id },
      relations: ["author", "author.userDecorations", "author.userDecorations.decoration", "article", "parent"],
    });

    if (!comment) {
      throw new NotFoundException("response.error.commentNotFound");
    }

    // 获取 rootId：如果是顶级评论就用自己的 id，否则用 rootId
    const rootId = comment.rootId || comment.id;

    // 分页查所有子评论（包括多层级），添加装饰品关联
    const [replies, totalReplies] = await this.commentRepository.findAndCount({
      where: { rootId: rootId, status: "PUBLISHED" },
      relations: ["author", "author.userDecorations", "author.userDecorations.decoration", "parent", "parent.author", "parent.author.userDecorations", "parent.author.userDecorations.decoration", "article"],
      select: {
        article: {
          id: true,
          title: true,
          cover: true,
          views: true,
          likes: true,
          viewPrice: true,
          requireFollow: true,
          requireLogin: true,
          requireMembership: true,
          requirePayment: true,
          updatedAt: true,
          createdAt: true,
        },
      },

      order: { createdAt: "ASC" },
      skip: (page - 1) * limit,
      take: limit,
    });

    // 查询用户点赞状态
    let userLikedCommentIds: Set<number> = new Set();
    if (currentUser && replies.length > 0) {
      const commentIds = replies.map((reply) => reply.id);
      const userLikes = await this.commentLikeRepository.find({
        where: {
          userId: currentUser.id,
          commentId: In(commentIds),
        },
      });
      userLikedCommentIds = new Set(userLikes.map((like) => like.commentId));
    }

    // 使用统一的处理方法
    const safeReplies = replies.map((reply) => ({
      ...this.addParentAndRootId(reply),
      isLiked: userLikedCommentIds.has(reply.id),
    }));

    const proessedSafeReplies = await Promise.all(
      safeReplies.map(async (reply) => {
        const isMember = await this.checkUserMembershipStatus(reply.author);
        // 处理文章图片
        this.processArticleImages(reply.article);
        return {
          ...reply,
          author: sanitizeUser({ ...processUserDecorations(reply.author), isMember }),
          parent: reply.parent ? {
            ...reply.parent,
            author: sanitizeUser(processUserDecorations(reply.parent.author)),
          } : null,
        };
      }),
    );
    return ListUtil.buildPaginatedList(
      proessedSafeReplies,
      totalReplies,
      page,
      limit,
    );
  }

  /**
   * 更新评论
   */
  async updateComment(
    id: number,
    updateCommentDto: UpdateCommentDto,
    currentUser: User,
  ) {
    const comment = await this.commentRepository.findOne({
      where: { id },
      relations: ["article", "author"],
    });

    if (!comment) {
      throw new NotFoundException("response.error.commentNotFound");
    }

    // 检查权限：只有评论作者或管理员可以修改
    if (
      comment.author.id !== currentUser.id &&
      !PermissionUtil.hasPermission(currentUser, "comment:manage")
    ) {
      throw new ForbiddenException("response.error.noPermission");
    }

    // 允许修改内容和图片
    const { content, images } = updateCommentDto;
    if (content !== undefined) {
      comment.content = content;
    }
    if (images !== undefined) {
      comment.images = this.serializeImages(images) || '';
    }

    const updatedComment = await this.commentRepository.save(comment);
    
    // 反序列化images字段返回
    return {
      success: true,
      message: "response.success.commentUpdate",
      data: this.processComment(updatedComment),
    };
  }

  /**
   * 删除评论
   */
  async removeComment(id: number, currentUser: User) {
    const comment = await this.commentRepository.findOne({
      where: { id },
      relations: ["author", "article", "parent"],
    });

    if (!comment) {
      throw new NotFoundException("response.error.commentNotFound");
    }

    // 检查权限：只有评论作者、文章作者或管理员可以删除
    const canDelete =
      comment.author.id === currentUser.id ||
      comment.article.author.id === currentUser.id ||
      PermissionUtil.hasPermission(currentUser, "comment:manage");

    if (!canDelete) {
      throw new ForbiddenException("response.error.noPermission");
    }

    // 如果是回复评论，减少父评论的回复数
    if (comment.parent) {
      comment.parent.replyCount = Math.max(0, comment.parent.replyCount - 1);
      await this.commentRepository.save(comment.parent);
    }

    // 更新文章评论数（只有顶级评论才减少文章的评论数）
    if (!comment.parent) {
      try {
        await this.articleRepository.increment({ id: comment.article.id }, "commentCount", -1);
        
        // 确保评论数不为负数
        const updatedArticle = await this.articleRepository.findOne({ where: { id: comment.article.id } });
        if (updatedArticle && updatedArticle.commentCount < 0) {
          await this.articleRepository.update(comment.article.id, { commentCount: 0 });
        }
      } catch (error) {
        console.error("更新文章评论数失败:", error);
      }
    }

    await this.commentRepository.remove(comment);
    return { success: true, message: "response.success.commentDelete" };
  }

  /**
   * 点赞/取消点赞评论
   */
  async like(id: number, user: User) {
    const comment = await this.commentRepository.findOne({ 
      where: { id },
      relations: ['author', 'article']
    });

    if (!comment) {
      throw new NotFoundException("response.error.commentNotFound");
    }

    // 查找是否已点赞
    const existingLike = await this.commentLikeRepository.findOne({
      where: {
        commentId: id,
        userId: user.id,
      },
    });

    if (existingLike) {
      // 已点赞，取消点赞
      await this.commentLikeRepository.remove(existingLike);
      await this.commentRepository.decrement({ id }, "likes", 1);

      return {
        success: true,
        message: "response.success.commentUnlike",
        data: { isLiked: false },
      };
    } else {
      // 未点赞，添加点赞
      const like = this.commentLikeRepository.create({
        commentId: id,
        userId: user.id,
      });
      await this.commentLikeRepository.save(like);
      await this.commentRepository.increment({ id }, "likes", 1);

      // 触发点赞事件（用于装饰品活动进度、积分系统和通知）
      try {
        this.eventEmitter.emit('comment.liked', { 
          userId: user.id,
          userName: user.nickname || user.username,
          commentId: id,
          commentContent: comment.content,
          authorId: comment.author?.id,
          articleId: comment.article?.id 
        });
        // 触发评论被点赞事件（给评论作者积分）
        if (comment.author?.id && comment.author.id !== user.id) {
          this.eventEmitter.emit('comment.receivedLike', {
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
  }

  /**
   * 获取文章的评论总数
   */
  async getCommentCount(articleId: number) {
    return await this.commentRepository.count({
      where: {
        article: { id: articleId },
        status: "PUBLISHED",
      },
    });
  }

  /**
   * 获取用户的评论
   */
  async getUserComments(userId: number, pagination: PaginationDto) {
    const { page, limit } = pagination;

    const findOptions = {
      where: {
        author: { id: userId },
        status: "PUBLISHED",
      },
      relations: ["article", "author", "author.userDecorations", "author.userDecorations.decoration", "parent", "parent.author"],
      order: {
        createdAt: "DESC" as const,
      },
      skip: (page - 1) * limit,
      take: limit,
    };

    const [data, total] =
      await this.commentRepository.findAndCount(findOptions);

    // 反序列化images字段并脱敏用户数据
    const processedData = data.map((comment) => {
      // 处理文章图片
      this.processArticleImages(comment.article);
      
      // 构建回复目标信息
      const replyTo = comment.parent ? {
        commentId: comment.parent.id,
        content: comment.parent.content,
        author: {
          id: comment.parent.author.id,
          username: comment.parent.author.username,
          nickname: comment.parent.author.nickname,
          avatar: comment.parent.author.avatar,
        },
      } : null;
      
      return {
        ...this.processComment(comment),
        author: sanitizeUser(processUserDecorations(comment.author)),
        replyTo,
        parentId: comment.parent?.id || null,
        rootId: comment.rootId || comment.id,
      };
    });

    return ListUtil.fromFindAndCount([processedData, total], page, limit);
  }

  /**
   * 根据文章ID查找评论
   */
  async findByArticleId(articleId: number) {
    const comments = await this.commentRepository.find({
      where: {
        article: { id: articleId },
        status: "PUBLISHED",
      },
      relations: ["author", "author.userDecorations", "author.userDecorations.decoration", "article", "parent", "parent.author"],
      order: {
        createdAt: "DESC",
      },
    });
    
    return comments.map((comment) => {
      // 处理文章图片
      this.processArticleImages(comment.article);
      
      // 构建回复目标信息
      const replyTo = comment.parent ? {
        commentId: comment.parent.id,
        content: comment.parent.content,
        author: {
          id: comment.parent.author.id,
          username: comment.parent.author.username,
          nickname: comment.parent.author.nickname,
          avatar: comment.parent.author.avatar,
        },
      } : null;
      
      return {
        ...this.processComment(comment),
        author: sanitizeUser(processUserDecorations(comment.author)),
        replyTo,
        parentId: comment.parent?.id || null,
        rootId: comment.rootId || comment.id,
      };
    });
  }

  /**
   * 获取热门评论
   */
  async getPopularComments(articleId: number, limit: number = 5) {
    const comments = await this.commentRepository.find({
      where: {
        article: { id: articleId },
        status: "PUBLISHED",
      },
      relations: ["author", "author.userDecorations", "author.userDecorations.decoration", "article", "parent", "parent.author"],
      order: {
        createdAt: "DESC",
      },
      take: limit,
    });
    
    return comments.map((comment) => {
      // 处理文章图片
      this.processArticleImages(comment.article);
      
      // 构建回复目标信息
      const replyTo = comment.parent ? {
        commentId: comment.parent.id,
        content: comment.parent.content,
        author: {
          id: comment.parent.author.id,
          username: comment.parent.author.username,
          nickname: comment.parent.author.nickname,
          avatar: comment.parent.author.avatar,
        },
      } : null;
      
      return {
        ...this.processComment(comment),
        author: sanitizeUser(processUserDecorations(comment.author)),
        replyTo,
        parentId: comment.parent?.id || null,
        rootId: comment.rootId || comment.id,
      };
    });
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
}





