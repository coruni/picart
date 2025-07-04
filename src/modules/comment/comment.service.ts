import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { Comment } from './entities/comment.entity';
import { User } from '../user/entities/user.entity';
import { Article } from '../article/entities/article.entity';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { PermissionUtil, sanitizeUser } from 'src/common/utils';
import { BaseService, PaginatedResult } from 'src/common/services/base.service';

@Injectable()
export class CommentService extends BaseService<Comment> {
  constructor(
    @InjectRepository(Comment)
    private commentRepository: Repository<Comment>,
    @InjectRepository(Article)
    private articleRepository: Repository<Article>,
  ) {
    super(commentRepository, '评论');
  }

  /**
   * 创建评论
   */
  async createComment(createCommentDto: CreateCommentDto, author: User): Promise<Comment> {
    const { articleId, parentId, ...commentData } = createCommentDto;

    // 查找文章
    const article = await this.articleRepository.findOne({
      where: { id: articleId },
      relations: ['author'],
    });
    if (!article) {
      throw new Error('文章不存在');
    }

    // 创建评论
    const comment = this.commentRepository.create({
      ...commentData,
      author,
      article,
      status: 'PUBLISHED',
    });

    // 如果是回复评论
    if (parentId) {
      const parent = await this.findOne(parentId, {
        relations: ['article'],
      });

      if (parent.article.id !== articleId) {
        throw new Error('父评论不属于该文章');
      }

      comment.parent = parent;
      parent.replyCount += 1;
      await this.save(parent);
    }

    const savedComment = await this.save(comment);
    return savedComment;
  }

  /**
   * 辅助函数：补充 parentId 和 rootId 字段
   */
  private static addParentAndRootId(comment: any): any {
    const parentId = comment.parent ? comment.parent.id : null;
    const rootId = parentId ? (comment.parent.rootId ?? comment.parent.id) : comment.id;
    return {
      ...comment,
      author: sanitizeUser(comment.author),
      parent: comment.parent ? { id: comment.parent.id } : null,
      parentId,
      rootId,
    };
  }

  /**
   * 分页查询文章的评论
   */
  async findCommentsByArticle(
    articleId: number,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<any>> {
    const { page, limit } = pagination;

    // 验证文章是否存在
    const article = await this.articleRepository.findOne({ where: { id: articleId } });
    if (!article) {
      throw new Error('文章不存在');
    }

    // 只查父评论（不查 replies）
    const [comments, total] = await this.commentRepository.findAndCount({
      where: {
        article: { id: articleId },
        parent: IsNull(),
        status: 'PUBLISHED',
      },
      relations: ['author'],
      order: {
        createdAt: 'DESC',
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    // 对每个父评论，查前5条子评论，并补充 parentId/rootId
    const commentsWithReplies = await Promise.all(
      comments.map(async parent => {
        const replies = await this.commentRepository.find({
          where: { parent: { id: parent.id }, status: 'PUBLISHED' },
          relations: ['author', 'parent'],
          order: { createdAt: 'ASC' },
          take: 5,
        });
        return {
          ...CommentService.addParentAndRootId(parent),
          replies: replies.map(CommentService.addParentAndRootId),
        };
      }),
    );

    return {
      data: commentsWithReplies,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 查询评论详情（包含分页的回复）
   */
  async findCommentDetail(id: number, repliesPage = 1, repliesLimit = 10): Promise<any> {
    const comment = await super.findOne(id, {
      relations: ['author', 'article', 'parent'],
    });

    // 分页查 replies
    const [replies, totalReplies] = await this.commentRepository.findAndCount({
      where: { parent: { id }, status: 'PUBLISHED' },
      relations: ['author', 'parent'],
      order: { createdAt: 'ASC' },
      skip: (repliesPage - 1) * repliesLimit,
      take: repliesLimit,
    });

    return {
      ...CommentService.addParentAndRootId(comment),
      replies: {
        data: replies.map(CommentService.addParentAndRootId),
        meta: {
          total: totalReplies,
          page: repliesPage,
          limit: repliesLimit,
          totalPages: Math.ceil(totalReplies / repliesLimit),
        },
      },
    };
  }

  /**
   * 更新评论
   */
  async updateComment(
    id: number,
    updateCommentDto: UpdateCommentDto,
    currentUser: User,
  ): Promise<Comment> {
    const comment = await this.findOne(id);

    // 检查权限：只有评论作者或管理员可以修改
    if (
      comment.author.id !== currentUser.id &&
      !PermissionUtil.hasPermission(currentUser, 'comment:manage')
    ) {
      throw new ForbiddenException('您没有权限修改此评论');
    }

    // 只允许修改内容
    const { content } = updateCommentDto;
    if (content) {
      comment.content = content;
    }

    return await this.save(comment);
  }

  /**
   * 删除评论
   */
  async removeComment(id: number, currentUser: User): Promise<void> {
    const comment = await this.findOne(id);

    // 检查权限：只有评论作者、文章作者或管理员可以删除
    const canDelete =
      comment.author.id === currentUser.id ||
      comment.article.author.id === currentUser.id ||
      PermissionUtil.hasPermission(currentUser, 'comment:manage');

    if (!canDelete) {
      throw new ForbiddenException('您没有权限删除此评论');
    }

    // 如果是回复评论，减少父评论的回复数
    if (comment.parent) {
      comment.parent.replyCount = Math.max(0, comment.parent.replyCount - 1);
      await this.save(comment.parent);
    }

    await super.remove(id);
  }

  /**
   * 点赞评论
   */
  async like(id: number, user: User): Promise<{ liked: boolean; likeCount: number }> {
    const comment = await this.findOne(id);

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
  async getReplies(parentId: number, pagination: PaginationDto): Promise<PaginatedResult<any>> {
    const { page, limit } = pagination;

    // 验证父评论是否存在
    await this.findOne(parentId);

    const [replies, total] = await this.commentRepository.findAndCount({
      where: { parent: { id: parentId }, status: 'PUBLISHED' },
      relations: ['author', 'parent'],
      order: { createdAt: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: replies.map(CommentService.addParentAndRootId),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 获取文章的评论总数
   */
  async getCommentCount(articleId: number): Promise<number> {
    return await this.count({
      where: {
        article: { id: articleId },
        status: 'PUBLISHED',
      },
    });
  }

  /**
   * 获取用户的评论
   */
  async getUserComments(
    userId: number,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<Comment>> {
    return await super.findAll(pagination, {
      where: {
        author: { id: userId },
        status: 'PUBLISHED',
      },
      relations: ['article', 'author'],
      order: {
        createdAt: 'DESC',
      },
    });
  }

  /**
   * 根据文章ID查找评论
   */
  async findByArticleId(articleId: number): Promise<Comment[]> {
    return await this.findBy({
      where: {
        article: { id: articleId },
        status: 'PUBLISHED',
      },
      relations: ['author'],
      order: {
        createdAt: 'DESC',
      },
    });
  }

  /**
   * 获取热门评论
   */
  async getPopularComments(articleId: number, limit: number = 5): Promise<Comment[]> {
    return await this.findBy({
      where: {
        article: { id: articleId },
        status: 'PUBLISHED',
      },
      relations: ['author'],
      order: {
        createdAt: 'DESC',
      },
      take: limit,
    });
  }
}
