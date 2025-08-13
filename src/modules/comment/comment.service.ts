import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, IsNull } from "typeorm";
import { CreateCommentDto } from "./dto/create-comment.dto";
import { UpdateCommentDto } from "./dto/update-comment.dto";
import { Comment } from "./entities/comment.entity";
import { User } from "../user/entities/user.entity";
import { Article } from "../article/entities/article.entity";
import { PaginationDto } from "src/common/dto/pagination.dto";
import { PermissionUtil, sanitizeUser, ListUtil } from "src/common/utils";

@Injectable()
export class CommentService {
  constructor(
    @InjectRepository(Comment)
    private commentRepository: Repository<Comment>,
    @InjectRepository(Article)
    private articleRepository: Repository<Article>,
  ) {}

  /**
   * 创建评论
   */
  async createComment(createCommentDto: CreateCommentDto, author: User) {
    const { articleId, parentId, ...commentData } = createCommentDto;

    // 查找文章
    const article = await this.articleRepository.findOne({
      where: { id: articleId },
      relations: ["author"],
    });
    if (!article) {
      throw new Error("文章不存在");
    }

    // 创建评论
    const comment = this.commentRepository.create({
      ...commentData,
      author,
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
    return savedComment;
  }

  /**
   * 辅助函数：补充 parentId 和 rootId 字段
   */
  private static addParentAndRootId(comment: any): any {
    const parentId = comment.parent ? comment.parent.id : null;
    // 优先使用数据库中的 rootId，如果没有则计算
    const rootId = comment.rootId || (parentId
      ? (comment.parent.rootId ?? comment.parent.id)
      : comment.id);
    return {
      ...comment,
      author: sanitizeUser(comment.author),
      parent: comment.parent ? { 
        id: comment.parent.id,
        author: comment.parent.author ? sanitizeUser(comment.parent.author) : null
      } : null,
      parentId,
      rootId,
    };
  }

  /**
   * 分页查询文章的评论
   */
  async findCommentsByArticle(articleId: number, pagination: PaginationDto) {
    const { page, limit } = pagination;

    // 验证文章是否存在
    const article = await this.articleRepository.findOne({
      where: { id: articleId },
    });
    if (!article) {
      throw new NotFoundException("response.error.articleNotFound");
    }

    // 只查父评论（不查 replies）
    const [comments, total] = await this.commentRepository.findAndCount({
      where: {
        article: { id: articleId },
        parent: IsNull(),
        status: "PUBLISHED",
      },
      relations: ["author", "article"],
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

    // 对每个父评论，查前5条子评论，并补充 parentId/rootId
    const commentsWithReplies = await Promise.all(
      comments.map(async (parent) => {
        const replies = await this.commentRepository.find({
          where: { parent: { id: parent.id }, status: "PUBLISHED" },
          relations: ["author", "parent", "parent.author", "article"],
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
        return {
          ...CommentService.addParentAndRootId(parent),
          replies: replies.map(CommentService.addParentAndRootId),
        };
      }),
    );

    return ListUtil.buildPaginatedList(commentsWithReplies, total, page, limit);
  }

  /**
   * 查询评论详情（包含分页的回复）
   */
  async findCommentDetail(id: number, pagination: PaginationDto) {
    const { page, limit } = pagination;
    const comment = await this.commentRepository.findOne({
      where: { id },
      relations: ["author", "article", "parent"],
    });

    if (!comment) {
      throw new NotFoundException("response.error.commentNotFound");
    }

    // 获取 rootId：如果是顶级评论就用自己的 id，否则用 rootId
    const rootId = comment.rootId || comment.id;

    // 分页查所有子评论（包括多层级）
    const [replies, totalReplies] = await this.commentRepository.findAndCount({
      where: { rootId: rootId, status: "PUBLISHED" },
      relations: ["author", "parent", "parent.author", "article"],
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

    // 使用统一的处理方法
    const safeReplies = replies.map(CommentService.addParentAndRootId);

    return ListUtil.buildPaginatedList(safeReplies, totalReplies, page, limit);
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

    // 只允许修改内容
    const { content } = updateCommentDto;
    if (content) {
      comment.content = content;
    }

    return await this.commentRepository.save(comment);
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
      throw new NotFoundException("评论不存在");
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

    await this.commentRepository.remove(comment);
  }

  /**
   * 点赞评论
   */
  async like(id: number, user: User) {
    const comment = await this.commentRepository.findOne({ where: { id } });

    if (!comment) {
      throw new NotFoundException("response.error.commentNotFound");
    }

    // 这里可以实现点赞逻辑
    // 暂时返回模拟数据
    return {
      liked: true,
      likeCount: (comment as any).likeCount + 1,
    };
  }

  /**
   * 获取评论的回复
   */
  async getReplies(parentId: number, pagination: PaginationDto) {
    const { page, limit } = pagination;

    // 验证父评论是否存在
    const parentComment = await this.commentRepository.findOne({ 
      where: { id: parentId },
      relations: ["author"]
    });

    if (!parentComment) {
      throw new NotFoundException("response.error.commentNotFound");
    }

    const [replies, total] = await this.commentRepository.findAndCount({
      where: { parent: { id: parentId }, status: "PUBLISHED" },
      relations: ["author", "parent"],
      order: { createdAt: "ASC" },
      skip: (page - 1) * limit,
      take: limit,
    });

    const data = replies.map(CommentService.addParentAndRootId);
    return ListUtil.buildPaginatedList(data, total, page, limit);
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
      relations: ["article", "author"],
      order: {
        createdAt: "DESC" as const,
      },
      skip: (page - 1) * limit,
      take: limit,
    };

    const [data, total] =
      await this.commentRepository.findAndCount(findOptions);

    return ListUtil.fromFindAndCount([data, total], page, limit);
  }

  /**
   * 根据文章ID查找评论
   */
  async findByArticleId(articleId: number) {
    return await this.commentRepository.find({
      where: {
        article: { id: articleId },
        status: "PUBLISHED",
      },
      relations: ["author"],
      order: {
        createdAt: "DESC",
      },
    });
  }

  /**
   * 获取热门评论
   */
  async getPopularComments(articleId: number, limit: number = 5) {
    return await this.commentRepository.find({
      where: {
        article: { id: articleId },
        status: "PUBLISHED",
      },
      relations: ["author"],
      order: {
        createdAt: "DESC",
      },
      take: limit,
    });
  }
}
