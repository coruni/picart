import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { Comment } from './entities/comment.entity';
import { User } from '../user/entities/user.entity';
import { Article } from '../article/entities/article.entity';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { PermissionUtil, sanitizeUser } from 'src/common/utils';

@Injectable()
export class CommentService {
  constructor(
    @InjectRepository(Comment)
    private commentRepository: Repository<Comment>,
    @InjectRepository(Article)
    private articleRepository: Repository<Article>,
  ) {}

  async create(createCommentDto: CreateCommentDto, author: User) {
    const { articleId, parentId, ...commentData } = createCommentDto;

    // 查找文章
    const article = await this.articleRepository.findOne({
      where: { id: articleId },
      relations: ['author'],
    });
    if (!article) {
      throw new NotFoundException('文章不存在');
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
      const parent = await this.commentRepository.findOne({
        where: { id: parentId },
        relations: ['article'],
      });

      if (!parent) {
        throw new NotFoundException('父评论不存在');
      }

      if (parent.article.id !== articleId) {
        throw new NotFoundException('父评论不属于该文章');
      }

      comment.parent = parent;
      parent.replyCount += 1;
      await this.commentRepository.save(parent);
    }

    const savedComment = await this.commentRepository.save(comment);

    return savedComment;
  }

  // 辅助函数：补充 parentId 和 rootId 字段
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

  async findAll(articleId: number, pagination: PaginationDto) {
    const { page, limit } = pagination;
    // 验证文章是否存在
    const article = await this.articleRepository.findOne({ where: { id: articleId } });
    if (!article) {
      throw new NotFoundException('文章不存在');
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

  async findOne(id: number, repliesPage = 1, repliesLimit = 10) {
    const comment = await this.commentRepository.findOne({
      where: { id },
      relations: ['author', 'article', 'parent'],
    });

    if (!comment) {
      throw new NotFoundException('评论不存在');
    }

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

  async update(id: number, updateCommentDto: UpdateCommentDto, currentUser: User) {
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

    const updatedComment = await this.commentRepository.save(comment);

    return updatedComment;
  }

  async remove(id: number, currentUser: User) {
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
      await this.commentRepository.save(comment.parent);
    }

    const result = await this.commentRepository.remove(comment);

    return { success: true, data: result };
  }

  async like(id: number, user: User) {
    const comment = await this.findOne(id);

    // 检查是否已经点赞（这里简化处理，实际项目中应该有点赞表）
    // 在实际项目中，你应该有一个 CommentLike 实体来记录点赞状态
    comment.likes += 1;

    const updatedComment = await this.commentRepository.save(comment);

    return updatedComment;
  }

  async getReplies(parentId: number, pagination: PaginationDto) {
    const { page, limit } = pagination;

    // 验证父评论是否存在
    const parentComment = await this.commentRepository.findOne({
      where: { id: parentId },
    });
    if (!parentComment) {
      throw new NotFoundException('父评论不存在');
    }

    const [replies, total] = await this.commentRepository.findAndCount({
      where: {
        parent: { id: parentId },
        status: 'PUBLISHED',
      },
      relations: ['author'],
      order: {
        createdAt: 'ASC',
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: replies,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getCommentCount(articleId: number): Promise<number> {
    return this.commentRepository.count({
      where: {
        article: { id: articleId },
        status: 'PUBLISHED',
      },
    });
  }

  async getUserComments(userId: number, pagination: PaginationDto) {
    const { page, limit } = pagination;

    const [comments, total] = await this.commentRepository.findAndCount({
      where: {
        author: { id: userId },
        status: 'PUBLISHED',
      },
      relations: ['article', 'parent'],
      order: {
        createdAt: 'DESC',
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: comments,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
