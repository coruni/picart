import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository, In, FindOptionsWhere } from 'typeorm';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { Article } from './entities/article.entity';
import { User } from '../user/entities/user.entity';
import { Category } from '../category/entities/category.entity';
import { Tag } from '../tag/entities/tag.entity';
import { ArticleLike } from './entities/article-like.entity';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { PermissionUtil, sanitizeUser } from 'src/common/utils';
import { TagService } from '../tag/tag.service';
import { UserService } from '../user/user.service';
import { OrderService } from '../order/order.service';
import { ListUtil } from 'src/common/utils';
import { ArticleLikeDto } from './dto/article-reaction.dto';

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
  ) {}

  /**
   * 创建文章
   */
  async createArticle(createArticleDto: CreateArticleDto, author: User) {
    const { categoryId, tagIds, tagNames, ...articleData } = createArticleDto;

    // 查找分类
    const category = await this.categoryRepository.findOne({ where: { id: categoryId } });
    if (!category) {
      throw new Error('分类不存在');
    }

    // 处理 images 字段：如果是数组则转换为逗号分隔的字符串
    if (articleData.images && Array.isArray(articleData.images)) {
      articleData.images = articleData.images.join(',');
    }

    // 创建文章
    const article = this.articleRepository.create({
      ...articleData,
      author,
      category,
    });

    // 处理标签
    const tags: Tag[] = [];

    // 如果有标签ID，查找现有标签
    if (tagIds && tagIds.length > 0) {
      const existingTags = await this.tagRepository.find({ where: { id: In(tagIds) } });
      tags.push(...existingTags);
    }

    // 如果有标签名称，创建或查找标签
    if (tagNames && tagNames.length > 0) {
      const createdTags = await this.tagService.findOrCreateTags(tagNames);
      // 避免重复添加
      createdTags.forEach(tag => {
        if (!tags.find(t => t.id === tag.id)) {
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
  async findAllArticles(pagination: PaginationDto, title?: string) {
    const whereCondition: FindOptionsWhere<Article> = {
      status: 'PUBLISHED',
    };

    if (title) {
      whereCondition.title = Like(`%${title}%`);
    }

    const { page, limit } = pagination;

    const findOptions = {
      where: whereCondition,
      relations: ['author', 'category', 'tags'],
      order: {
        createdAt: 'DESC' as const,
      },
      skip: (page - 1) * limit,
      take: limit,
    };

    const [data, total] = await this.articleRepository.findAndCount(findOptions);

    // 脱敏 author 字段
    const safeArticles = data.map(article => ({
      ...article,
      author: sanitizeUser(article.author),
    }));

    return ListUtil.buildPaginatedList(safeArticles, total, page, limit);
  }

  /**
   * 根据ID查询文章详情
   */
  async findOne(id: number, currentUser?: User): Promise<Article> {
    const article = await this.articleRepository.findOne({
      where: { id },
      relations: ['author', 'category', 'tags'],
    });

    if (!article) {
      throw new NotFoundException('文章不存在');
    }

    // 权限校验
    if (article.requireLogin && !currentUser) {
      throw new ForbiddenException('请先登录后查看');
    }

    if (article.requireFollow && currentUser && currentUser.id !== article.author.id) {
      // 检查用户是否关注了作者
      const hasFollowed = await this.checkUserFollowStatus(currentUser.id, article.author.id);
      if (!hasFollowed) {
        throw new ForbiddenException('请先关注作者后查看');
      }
    }

    if (article.requirePayment && currentUser && currentUser.id !== article.author.id) {
      // 检查用户是否已支付
      const hasPaid = await this.checkUserPaymentStatus(currentUser.id, article.id);
      if (!hasPaid) {
        throw new ForbiddenException(`请先支付 ${article.viewPrice} 元后查看`);
      }
    }

    // 增加阅读量
    await this.incrementViews(id);

    // 脱敏 author 字段
    return {
      ...article,
      author: sanitizeUser(article.author),
    };
  }

  /**
   * 更新文章
   */
  async update(id: number, updateArticleDto: UpdateArticleDto, currentUser: User): Promise<Article> {

    const { categoryId, tagIds, tagNames, ...articleData } = updateArticleDto;
    const article = await this.findOne(id);

    // 检查是否是作者
    if (currentUser.id !== article.authorId && !PermissionUtil.hasPermission(currentUser, 'article:manage')) {
      throw new ForbiddenException('您没有权限更新此文章');
    } 

    // 处理 images 字段：如果是数组则转换为逗号分隔的字符串
    if (articleData.images && Array.isArray(articleData.images)) {
      articleData.images = articleData.images.join(',');
    }

    // 更新分类
    if (categoryId) {
      const category = await this.categoryRepository.findOne({ where: { id: categoryId } });
      if (!category) {
        throw new Error('分类不存在');
      }
      article.category = category;
    }

    // 处理标签更新
    if (tagIds || tagNames) {
      const tags: Tag[] = [];

      // 如果有标签ID，查找现有标签
      if (tagIds && tagIds.length > 0) {
        const existingTags = await this.tagRepository.find({ where: { id: In(tagIds) } });
        tags.push(...existingTags);
      }

      // 如果有标签名称，创建或查找标签
      if (tagNames && tagNames.length > 0) {
        const createdTags = await this.tagService.findOrCreateTags(tagNames);
        // 避免重复添加
        createdTags.forEach(tag => {
          if (!tags.find(t => t.id === tag.id)) {
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
  async remove(id: number): Promise<void> {
    const article = await this.findOne(id);
    await this.articleRepository.remove(article);
  }

  /**
   * 点赞文章或添加表情回复
   */
  async like(articleId: number, user: User, likeDto?: ArticleLikeDto): Promise<{ 
    liked: boolean; 
    likeCount: number; 
    reactionStats: { [key: string]: number };
    userReaction?: any;
  }> {
    const article = await this.findOne(articleId);
    const reactionType = likeDto?.reactionType || 'like';

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
        
        return {
          liked: false,
          likeCount: await this.getLikeCount(articleId),
          reactionStats: await this.getReactionStats(articleId),
        };
      } else {
        // 不同表情，更新
        existingLike.reactionType = reactionType;
        const savedReaction = await this.articleLikeRepository.save(existingLike);
        
        return {
          liked: true,
          likeCount: await this.getLikeCount(articleId),
          reactionStats: await this.getReactionStats(articleId),
          userReaction: savedReaction,
        };
      }
    } else {
      // 新表情回复
      const like = this.articleLikeRepository.create({
        articleId,
        userId: user.id,
        reactionType,
      });
      const savedReaction = await this.articleLikeRepository.save(like);

      return {
        liked: true,
        likeCount: await this.getLikeCount(articleId),
        reactionStats: await this.getReactionStats(articleId),
        userReaction: savedReaction,
      };
    }
  }

  /**
   * 获取文章点赞状态
   */
  async getLikeStatus(articleId: number, userId: number): Promise<{ liked: boolean; reactionType?: string }> {
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
        reactionType: 'like',
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
        reactionType: 'dislike',
      },
    });
    return count;
  }



  /**
   * 获取文章表情回复统计
   */
  async getReactionStats(articleId: number): Promise<{ [key: string]: number }> {
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

    reactions.forEach(reaction => {
      stats[reaction.reactionType]++;
    });

    return stats;
  }

  /**
   * 获取用户的表情回复
   */
  async getUserReaction(articleId: number, userId: number): Promise<any | null> {
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
      relations: ['user'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * 根据分类查找文章
   */
  async findByCategory(categoryId: number, pagination: PaginationDto) {
    const { page, limit } = pagination;

    const findOptions = {
      where: {
        category: { id: categoryId },
        status: 'PUBLISHED',
      },
      relations: ['author', 'category', 'tags'],
      order: {
        createdAt: 'DESC' as const,
      },
      skip: (page - 1) * limit,
      take: limit,
    };

    const [data, total] = await this.articleRepository.findAndCount(findOptions);

    return ListUtil.fromFindAndCount([data, total], page, limit);
  }

  /**
   * 根据标签查找文章
   */
  async findByTag(tagId: number, pagination: PaginationDto) {
    const { page, limit } = pagination;

    const findOptions = {
      where: {
        tags: { id: tagId },
        status: 'PUBLISHED',
      },
      relations: ['author', 'category', 'tags'],
      order: {
        createdAt: 'DESC' as const,
      },
      skip: (page - 1) * limit,
      take: limit,
    };

    const [data, total] = await this.articleRepository.findAndCount(findOptions);

    return ListUtil.fromFindAndCount([data, total], page, limit);
  }

  /**
   * 根据作者查找文章
   */
  async findByAuthor(authorId: number, pagination: PaginationDto) {
    const { page, limit } = pagination;

    const findOptions = {
      where: {
        author: { id: authorId },
        status: 'PUBLISHED',
      },
      relations: ['author', 'category', 'tags'],
      order: {
        createdAt: 'DESC' as const,
      },
      skip: (page - 1) * limit,
      take: limit,
    };

    const [data, total] = await this.articleRepository.findAndCount(findOptions);

    return ListUtil.fromFindAndCount([data, total], page, limit);
  }

  /**
   * 搜索文章
   */
  async searchArticles(keyword: string, pagination: PaginationDto) {
    const { page, limit } = pagination;

    const findOptions = {
      where: [
        { title: Like(`%${keyword}%`), status: 'PUBLISHED' },
        { content: Like(`%${keyword}%`), status: 'PUBLISHED' },
        { summary: Like(`%${keyword}%`), status: 'PUBLISHED' },
      ],
      relations: ['author', 'category', 'tags'],
      order: {
        createdAt: 'DESC' as const,
      },
      skip: (page - 1) * limit,
      take: limit,
    };

    const [data, total] = await this.articleRepository.findAndCount(findOptions);

    return ListUtil.fromFindAndCount([data, total], page, limit);
  }

  /**
   * 获取热门文章
   */
  async getPopularArticles(limit: number = 10) {
    return await this.articleRepository.find({
      where: { status: 'PUBLISHED' },
      relations: ['author', 'category', 'tags'],
      order: {
        views: 'DESC',
        createdAt: 'DESC',
      },
      take: limit,
    });
  }

  /**
   * 获取最新文章
   */
  async getLatestArticles(limit: number = 10) {
    return await this.articleRepository.find({
      where: { status: 'PUBLISHED' },
      relations: ['author', 'category', 'tags'],
      order: {
        createdAt: 'DESC',
      },
      take: limit,
    });
  }

  /**
   * 获取推荐文章
   */
  async getRecommendedArticles(limit: number = 10) {
    return await this.articleRepository.find({
      where: {
        status: 'PUBLISHED',
      },
      relations: ['author', 'category', 'tags'],
      order: {
        createdAt: 'DESC',
      },
      take: limit,
    });
  }

  /**
   * 增加文章阅读量
   */
  async incrementViews(id: number) {
    const article = await this.articleRepository.findOne({ where: { id } });
    if (!article) {
      throw new NotFoundException('文章不存在');
    }
    return await this.articleRepository.increment({ id: id }, 'views', 1);
  }

  /**
   * 发布文章
   */
  async publishArticle(id: number) {
    return await this.articleRepository.update(id, { status: 'PUBLISHED' });
  }

  /**
   * 取消发布文章
   */
  async unpublishArticle(id: number) {
    return await this.articleRepository.update(id, { status: 'DRAFT' });
  }

  /**
   * 检查用户是否关注了作者
   */
  private async checkUserFollowStatus(userId: number, authorId: number): Promise<boolean> {
    try {
      // 检查用户是否在作者的关注者列表中
      const followers = await this.userService.getFollowers(authorId, { page: 1, limit: 1000 });
      return followers.data.some(follower => follower.id === userId);
    } catch (error) {
      console.error('检查关注关系失败:', error);
      return false;
    }
  }

  /**
   * 检查用户是否已支付文章费用
   */
  private async checkUserPaymentStatus(userId: number, articleId: number): Promise<boolean> {
    try {
      return await this.orderService.hasPaidForArticle(userId, articleId);
    } catch (error) {
      console.error('检查支付状态失败:', error);
      return false;
    }
  }
}
