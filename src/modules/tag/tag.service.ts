import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { FindManyOptions, Like, Repository } from "typeorm";
import { CreateTagDto } from "./dto/create-tag.dto";
import { UpdateTagDto } from "./dto/update-tag.dto";
import { Tag } from "./entities/tag.entity";
import { TagFollow } from "./entities/tag-follow.entity";
import { PaginationDto } from "src/common/dto/pagination.dto";
import { User } from "../user/entities/user.entity";
import { ListUtil } from "src/common/utils";

@Injectable()
export class TagService {
  constructor(
    @InjectRepository(Tag)
    private tagRepository: Repository<Tag>,
    @InjectRepository(TagFollow)
    private tagFollowRepository: Repository<TagFollow>,
  ) {}

  /**
   * 创建标签
   */
  async create(createTagDto: CreateTagDto) {
    const tag = this.tagRepository.create(createTagDto);
    const savedTag = await this.tagRepository.save(tag);
    return {
      success: true,
      message: "response.success.tagCreate",
      data: savedTag,
    };
  }

  /**
   * 分页查询所有标签
   */
  async findAll(pagination: PaginationDto, name: string, sortBy?: string, sortOrder?: 'ASC' | 'DESC') {
    const { page, limit } = pagination;

    // 构建查询条件
    const whereConditions = {
      ...(name && { name: Like(`%${name}%`) }),
    };

    // 处理排序
    const order: Record<string, 'ASC' | 'DESC'> = {};
    if (sortBy === 'createdAt' && (sortOrder === 'ASC' || sortOrder === 'DESC')) {
      order.createdAt = sortOrder;
    } else {
      order.sort = 'ASC';
      order.createdAt = 'DESC';
    }

    const findOptions: FindManyOptions<Tag> = {
      order,
      where: whereConditions,
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
    });

    if (!tag) {
      throw new NotFoundException("response.error.tagNotFound");
    }

    return tag;
  }

  /**
   * 更新标签
   */
  async update(id: number, updateTagDto: UpdateTagDto, currentUser?: User) {
    const tag = await this.findOne(id);
    Object.assign(tag, updateTagDto);
    const updatedTag = await this.tagRepository.save(tag);
    return {
      success: true,
      message: "response.success.tagUpdate",
      data: updatedTag,
    };
  }

  /**
   * 删除标签
   */
  async remove(id: number) {
    const tag = await this.findOne(id);
    await this.tagRepository.remove(tag);
    return { success: true, message: "response.success.tagDelete" };
  }

  /**
   * 增加文章数量
   */
  async incrementArticleCount(id: number) {
    const tag = await this.findOne(id);
    return await this.tagRepository.increment({ id: tag.id }, "articleCount", 1);
  }

  /**
   * 减少文章数量
   */
  async decrementArticleCount(id: number) {
    const tag = await this.findOne(id);
    if (tag.articleCount > 0) {
      return await this.tagRepository.decrement({ id: tag.id }, "articleCount", 1);
    }
    return tag;
  }

  /**
   * 关注标签
   */
  async followTag(id: number, userId: number) {
    const tag = await this.findOne(id);

    // 检查是否已关注
    const existingFollow = await this.tagFollowRepository.findOne({
      where: { tagId: id, userId },
    });

    if (existingFollow) {
      throw new BadRequestException("response.error.tagAlreadyFollowed");
    }

    // 创建关注记录
    const tagFollow = this.tagFollowRepository.create({
      tagId: id,
      userId,
    });
    await this.tagFollowRepository.save(tagFollow);

    // 增加关注数量
    await this.tagRepository.increment({ id: tag.id }, "followCount", 1);

    return {
      success: true,
      message: "response.success.tagFollow",
      data: { ...tag, followCount: tag.followCount + 1 }
    };
  }

  /**
   * 取消关注标签
   */
  async unfollowTag(id: number, userId: number) {
    const tag = await this.findOne(id);

    // 查找关注记录
    const tagFollow = await this.tagFollowRepository.findOne({
      where: { tagId: id, userId },
    });

    if (!tagFollow) {
      throw new BadRequestException("response.error.tagNotFollowed");
    }

    // 删除关注记录
    await this.tagFollowRepository.remove(tagFollow);

    // 减少关注数量
    if (tag.followCount > 0) {
      await this.tagRepository.decrement({ id: tag.id }, "followCount", 1);
    }

    return {
      success: true,
      message: "response.success.tagUnfollow",
      data: { ...tag, followCount: Math.max(0, tag.followCount - 1) }
    };
  }

  /**
   * 检查用户是否关注了标签
   */
  async isFollowing(tagId: number, userId: number): Promise<boolean> {
    const count = await this.tagFollowRepository.count({
      where: { tagId, userId },
    });
    return count > 0;
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
          avatar: "",
          background: "",
          cover: "",
          sort: 0,
        };
        const { data } = await this.create(createTagDto);
        tag = data;
      }

      // 避免重复添加
      if (tag && !tags.find((t) => t.id === tag.id)) {
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
        articleCount: "DESC",
        followCount: "DESC",
      },
      take: limit,
    });

    return ListUtil.buildSimpleList(data);
  }
}
