import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { Tag } from './entities/tag.entity';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { User } from '../user/entities/user.entity';
import { ListUtil } from 'src/common/utils';

@Injectable()
export class TagService {
  constructor(
    @InjectRepository(Tag)
    private tagRepository: Repository<Tag>,
  ) {}

  /**
   * 创建标签
   */
  async create(createTagDto: CreateTagDto): Promise<Tag> {
    const tag = this.tagRepository.create(createTagDto);
    return await this.tagRepository.save(tag);
  }

  /**
   * 分页查询所有标签
   */
  async findAll(pagination: PaginationDto) {
    const { page, limit } = pagination;

    const findOptions = {
      order: {
        sort: 'ASC' as const,
        createdAt: 'DESC' as const,
      },
      skip: (page - 1) * limit,
      take: limit,
    };

    const [data, total] = await this.tagRepository.findAndCount(findOptions);

    return ListUtil.fromFindAndCount([data, total], page, limit);
  }

  /**
   * 根据ID查询标签详情
   */
  async findOne(id: number) {
    const tag = await this.tagRepository.findOne({
      where: { id },
      relations: ['articles'],
    });

    if (!tag) {
      throw new NotFoundException('标签不存在');
    }

    return tag;
  }

  /**
   * 更新标签
   */
  async update(id: number, updateTagDto: UpdateTagDto, currentUser?: User) {
    const tag = await this.findOne(id);
    Object.assign(tag, updateTagDto);
    return await this.tagRepository.save(tag);
  }

  /**
   * 删除标签
   */
  async remove(id: number): Promise<void> {
    const tag = await this.findOne(id);
    await this.tagRepository.remove(tag);
  }

  /**
   * 增加文章数量
   */
  async incrementArticleCount(id: number) {
    const tag = await this.findOne(id);
    return await this.tagRepository.increment(tag, 'articleCount', 1);
  }

  /**
   * 减少文章数量
   */
  async decrementArticleCount(id: number) {
    const tag = await this.findOne(id);
    if (tag.articleCount > 0) {
      tag.articleCount -= 1;
      return await this.tagRepository.increment(tag, 'articleCount', -1);
    }
    return tag;
  }

  /**
   * 增加关注数量
   */
  async incrementFollowCount(id: number) {
    const tag = await this.findOne(id);
    return await this.tagRepository.increment(tag, 'followCount', 1);
  }

  /**
   * 减少关注数量
   */
  async decrementFollowCount(id: number) {
    const tag = await this.findOne(id);
    if (tag.followCount > 0) {
      return await this.tagRepository.decrement(tag, 'followCount', 1);
    }
    return tag;
  }

  /**
   * 根据名称查找标签
   */
  async findByName(name: string) {
    return await this.tagRepository.findOne({
      where: { name: name.trim() },
    });
  }

  /**
   * 批量查找或创建标签
   */
  async findOrCreateTags(tagNames: string[]) {
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
      if (!tags.find((t) => t.id === tag.id)) {
        tags.push(tag);
      }
    }

    return tags;
  }

  /**
   * 获取热门标签
   */
  async getPopularTags(limit: number = 10) {
    const data = await this.tagRepository.find({
      order: {
        articleCount: 'DESC',
        followCount: 'DESC',
      },
      take: limit,
    });

    return ListUtil.buildSimpleList(data);
  }
}
