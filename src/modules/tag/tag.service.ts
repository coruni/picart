import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { Tag } from './entities/tag.entity';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { BaseService, PaginatedResult } from 'src/common/services/base.service';
import { User } from '../user/entities/user.entity';

@Injectable()
export class TagService extends BaseService<Tag> {
  constructor(
    @InjectRepository(Tag)
    private tagRepository: Repository<Tag>,
  ) {
    super(tagRepository, '标签');
  }

  /**
   * 创建标签
   */
  async create(createTagDto: CreateTagDto): Promise<Tag> {
    return await super.create(createTagDto);
  }

  /**
   * 分页查询所有标签
   */
  async findAll(pagination: PaginationDto): Promise<PaginatedResult<Tag>> {
    return await super.findAll(pagination, {
      order: {
        sort: 'ASC',
        createdAt: 'DESC',
      },
    });
  }

  /**
   * 根据ID查询标签详情
   */
  async findOne(id: number): Promise<Tag> {
    return await super.findOne(id, {
      relations: ['articles'],
    });
  }

  /**
   * 更新标签
   */
  async update(id: number, updateTagDto: UpdateTagDto, currentUser?: User): Promise<Tag> {
    return await super.update(id, updateTagDto, currentUser);
  }

  /**
   * 删除标签
   */
  async remove(id: number): Promise<void> {
    await super.remove(id);
  }

  /**
   * 增加文章数量
   */
  async incrementArticleCount(id: number): Promise<Tag> {
    const tag = await this.findOne(id);
    tag.articleCount += 1;
    return await this.save(tag);
  }

  /**
   * 减少文章数量
   */
  async decrementArticleCount(id: number): Promise<Tag> {
    const tag = await this.findOne(id);
    if (tag.articleCount > 0) {
      tag.articleCount -= 1;
      return await this.save(tag);
    }
    return tag;
  }

  /**
   * 增加关注数量
   */
  async incrementFollowCount(id: number): Promise<Tag> {
    const tag = await this.findOne(id);
    tag.followCount += 1;
    return await this.save(tag);
  }

  /**
   * 减少关注数量
   */
  async decrementFollowCount(id: number): Promise<Tag> {
    const tag = await this.findOne(id);
    if (tag.followCount > 0) {
      tag.followCount -= 1;
      return await this.save(tag);
    }
    return tag;
  }

  /**
   * 根据名称查找标签
   */
  async findByName(name: string): Promise<Tag | null> {
    return await this.findOneBy({
      where: { name: name.trim() },
    });
  }

  /**
   * 批量查找或创建标签
   */
  async findOrCreateTags(tagNames: string[]): Promise<Tag[]> {
    const tags: Tag[] = [];

    for (const tagName of tagNames) {
      const trimmedName = tagName.trim();
      if (!trimmedName) continue;

      // 先查找是否已存在
      let tag = await this.findByName(trimmedName);

      // 如果不存在，创建新标签
      if (!tag) {
        const createTagDto: CreateTagDto = {
          name: trimmedName,
          description: `自动创建的标签: ${trimmedName}`,
          avatar: '',
          background: '',
          cover: '',
          sort: 0,
        };
        tag = await this.create(createTagDto);
      }

      // 避免重复添加
      if (!tags.find(t => t.id === tag.id)) {
        tags.push(tag);
      }
    }

    return tags;
  }

  /**
   * 获取热门标签
   */
  async getPopularTags(limit: number = 10): Promise<Tag[]> {
    return await this.findBy({
      order: {
        articleCount: 'DESC',
        followCount: 'DESC',
      },
      take: limit,
    });
  }
}
