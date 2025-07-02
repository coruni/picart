import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository, In } from 'typeorm';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { Article } from './entities/article.entity';
import { User } from '../user/entities/user.entity';
import { Category } from '../category/entities/category.entity';
import { Tag } from '../tag/entities/tag.entity';
import { ArticleLike } from './entities/article-like.entity';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { sanitizeUser } from 'src/common/utils';

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
  ) { }

  async create(createArticleDto: CreateArticleDto, author: User) {
    const { categoryId, tagIds, tagNames, ...articleData } = createArticleDto;

    // 查找分类
    const category = await this.categoryRepository.findOne({ where: { id: categoryId } });
    if (!category) {
      throw new NotFoundException('分类不存在');
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
      for (const tagName of tagNames) {
        // 先查找是否已存在同名标签
        let tag = await this.tagRepository.findOne({ 
          where: { name: tagName.trim() } 
        });
        
        // 如果不存在，创建新标签
        if (!tag) {
          tag = this.tagRepository.create({
            name: tagName.trim(),
            description: `自动创建的标签: ${tagName.trim()}`,
          });
          tag = await this.tagRepository.save(tag);
        }
        
        // 避免重复添加
        if (!tags.find(t => t.id === tag.id)) {
          tags.push(tag);
        }
      }
    }

    article.tags = tags;
    return this.articleRepository.save(article);
  }

  async findAll(pagination: PaginationDto, title?: string) {
    const { page, limit } = pagination;
    const [articles, total] = await this.articleRepository.findAndCount({
      where: {
        title: title ? Like(`%${title}%`) : undefined,
        status: 'PUBLISHED',
      },
      relations: ['author', 'category', 'tags'],
      skip: (page - 1) * limit,
      take: limit,
    });

    // 脱敏 author 字段
    const safeArticles = articles.map(article => ({
      ...article,
      author: sanitizeUser(article.author),
    }));

    return {
      data: safeArticles,
      meta: {
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number) {
    const article = await this.articleRepository.findOne({
      where: { id },
      relations: ['author', 'category', 'tags'],
    });

    if (!article) {
      throw new NotFoundException('文章不存在');
    }

    // 增加阅读量
    article.views += 1;
    await this.articleRepository.save(article);

    // 脱敏 author 字段
    return {
      ...article,
      author: sanitizeUser(article.author),
    };
  }

  async update(id: number, updateArticleDto: UpdateArticleDto) {
    const { categoryId, tagIds, tagNames, ...articleData } = updateArticleDto;
    const article = await this.findOne(id);

    // 更新分类
    if (categoryId) {
      const category = await this.categoryRepository.findOne({ where: { id: categoryId } });
      if (!category) {
        throw new NotFoundException('分类不存在');
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
        for (const tagName of tagNames) {
          // 先查找是否已存在同名标签
          let tag = await this.tagRepository.findOne({ 
            where: { name: tagName.trim() } 
          });
          
          // 如果不存在，创建新标签
          if (!tag) {
            tag = this.tagRepository.create({
              name: tagName.trim(),
              description: `自动创建的标签: ${tagName.trim()}`,
            });
            tag = await this.tagRepository.save(tag);
          }
          
          // 避免重复添加
          if (!tags.find(t => t.id === tag.id)) {
            tags.push(tag);
          }
        }
      }

      article.tags = tags;
    }

    // 更新其他字段
    Object.assign(article, articleData);

    return this.articleRepository.save(article);
  }

  async remove(id: number) {
    const article = await this.findOne(id);
    return this.articleRepository.remove(article);
  }

  async like(articleId: number, user: User) {
    const article = await this.findOne(articleId);

    // 查找是否已经点赞
    const existingLike = await this.articleLikeRepository.findOne({
      where: {
        article: { id: articleId },
        user: { id: user.id },
      },
    });

    if (existingLike) {
      // 如果已经点赞，则取消点赞
      await this.articleLikeRepository.remove(existingLike);
      article.likes -= 1;
    } else {
      // 如果没有点赞，则添加点赞记录
      const like = this.articleLikeRepository.create({
        article,
        user,
      });
      await this.articleLikeRepository.save(like);
      article.likes += 1;
    }

    return this.articleRepository.save(article);
  }

  async getLikeStatus(articleId: number, userId: number) {
    const like = await this.articleLikeRepository.findOne({
      where: {
        article: { id: articleId },
        user: { id: userId },
      },
    });

    return {
      isLiked: !!like,
    };
  }

  async getLikeCount(articleId: number) {
    const count = await this.articleLikeRepository.count({
      where: {
        article: { id: articleId },
      },
    });

    return count;
  }
}
