import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { Tag } from './entities/tag.entity';
import { PaginationDto } from 'src/common/dto/pagination.dto';

@Injectable()
export class TagService {
  constructor(
    @InjectRepository(Tag)
    private tagRepository: Repository<Tag>,
  ) {}

  async create(createTagDto: CreateTagDto) {
    const tag = this.tagRepository.create(createTagDto);
    return this.tagRepository.save(tag);
  }

  async findAll(pagination: PaginationDto) {
    const { page, limit } = pagination;
    const [tags, total] = await this.tagRepository.findAndCount({
      order: {
        sort: 'ASC',
        createdAt: 'DESC',
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: tags,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

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

  async update(id: number, updateTagDto: UpdateTagDto) {
    const tag = await this.findOne(id);
    Object.assign(tag, updateTagDto);
    return this.tagRepository.save(tag);
  }

  async remove(id: number) {
    const tag = await this.findOne(id);
    return this.tagRepository.remove(tag);
  }

  async incrementArticleCount(id: number) {
    const tag = await this.findOne(id);
    tag.articleCount += 1;
    return this.tagRepository.save(tag);
  }

  async decrementArticleCount(id: number) {
    const tag = await this.findOne(id);
    if (tag.articleCount > 0) {
      tag.articleCount -= 1;
      return this.tagRepository.save(tag);
    }
    return tag;
  }

  async incrementFollowCount(id: number) {
    const tag = await this.findOne(id);
    tag.followCount += 1;
    return this.tagRepository.save(tag);
  }

  async decrementFollowCount(id: number) {
    const tag = await this.findOne(id);
    if (tag.followCount > 0) {
      tag.followCount -= 1;
      return this.tagRepository.save(tag);
    }
    return tag;
  }
}
