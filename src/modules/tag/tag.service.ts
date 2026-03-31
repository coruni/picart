import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { FindManyOptions, In, Like, Repository } from "typeorm";
import { CreateTagDto } from "./dto/create-tag.dto";
import { UpdateTagDto } from "./dto/update-tag.dto";
import { Tag } from "./entities/tag.entity";
import { TagFollow } from "./entities/tag-follow.entity";
import { PaginationDto } from "src/common/dto/pagination.dto";
import { User } from "../user/entities/user.entity";
import { ListUtil, processUserDecorations, sanitizeUser } from "src/common/utils";
import { Article } from "../article/entities/article.entity";

@Injectable()
export class TagService {
  private static readonly RECENT_ARTICLE_DAYS = 7;

  constructor(
    @InjectRepository(Tag)
    private tagRepository: Repository<Tag>,
    @InjectRepository(TagFollow)
    private tagFollowRepository: Repository<TagFollow>,
    @InjectRepository(Article)
    private articleRepository: Repository<Article>,
  ) {}

  private async getTagEntity(id: number) {
    const tag = await this.tagRepository.findOne({
      where: { id },
    });

    if (!tag) {
      throw new NotFoundException("response.error.tagNotFound");
    }

    return tag;
  }

  private getRecentArticleStartDate() {
    const date = new Date();
    date.setDate(date.getDate() - TagService.RECENT_ARTICLE_DAYS);
    return date;
  }

  private shuffleArray<T>(array: T[]) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private async enrichTags(tags: Tag[], currentUser?: User) {
    if (!tags.length) {
      return [];
    }

    const tagIds = tags.map((tag) => tag.id);

    let followedTagIds = new Set<number>();
    if (currentUser?.id) {
      const existingFollows = await this.tagFollowRepository.find({
        where: {
          userId: currentUser.id,
          tagId: In(tagIds),
        },
      });
      followedTagIds = new Set(existingFollows.map((follow) => follow.tagId));
    }

    const tagFollows = await this.tagFollowRepository.find({
      where: { tagId: In(tagIds) },
      relations: [
        "user",
        "user.userDecorations",
        "user.userDecorations.decoration",
      ],
    });

    const randomUsersMap = new Map<number, any[]>();
    for (const follow of this.shuffleArray<TagFollow>(tagFollows)) {
      if (!follow.user) {
        continue;
      }

      const users = randomUsersMap.get(follow.tagId) || [];
      if (users.length >= 3) {
        continue;
      }

      users.push(sanitizeUser(processUserDecorations(follow.user)));
      randomUsersMap.set(follow.tagId, users);
    }

    const recentArticleRows = await this.articleRepository
      .createQueryBuilder("article")
      .leftJoin("article.tags", "tag")
      .select("tag.id", "tagId")
      .addSelect("COUNT(DISTINCT article.id)", "count")
      .where("tag.id IN (:...tagIds)", { tagIds })
      .andWhere("article.status = :status", { status: "PUBLISHED" })
      .andWhere("article.createdAt >= :startDate", {
        startDate: this.getRecentArticleStartDate(),
      })
      .groupBy("tag.id")
      .getRawMany<{ tagId: string; count: string }>();

    const recentArticleCountMap = new Map<number, number>(
      recentArticleRows.map((row) => [Number(row.tagId), Number(row.count)]),
    );

    return tags.map((tag) => ({
      ...tag,
      isFollowed: followedTagIds.has(tag.id),
      randomUsers: randomUsersMap.get(tag.id) || [],
      recentArticleCount: recentArticleCountMap.get(tag.id) || 0,
    }));
  }

  private async enrichTag(tag: Tag, currentUser?: User) {
    const [processedTag] = await this.enrichTags([tag], currentUser);
    return processedTag;
  }

  /**
   * 创建标签
   */
  async create(createTagDto: CreateTagDto) {
    const tag = this.tagRepository.create(createTagDto);
    const savedTag = await this.tagRepository.save(tag);
    return {
      success: true,
      message: "response.success.tagCreate",
      data: await this.enrichTag(savedTag),
    };
  }

  /**
   * 分页查询所有标签
   */
  async findAll(
    pagination: PaginationDto,
    name: string,
    sortBy?: string,
    sortOrder?: "ASC" | "DESC",
    currentUser?: User,
  ) {
    const { page, limit } = pagination;

    const whereConditions = {
      ...(name && { name: Like(`%${name}%`) }),
    };

    const order: Record<string, "ASC" | "DESC"> = {};
    if (sortBy === "hot") {
      const hotSortOrder = sortOrder === "ASC" ? "ASC" : "DESC";
      order.followCount = hotSortOrder;
      order.articleCount = hotSortOrder;
      order.createdAt = "DESC";
    } else if (
      sortBy === "createdAt" &&
      (sortOrder === "ASC" || sortOrder === "DESC")
    ) {
      order.createdAt = sortOrder;
    } else {
      order.sort = "ASC";
      order.createdAt = "DESC";
    }

    const findOptions: FindManyOptions<Tag> = {
      order,
      where: whereConditions,
      skip: (page - 1) * limit,
      take: limit,
    };

    const [data, total] = await this.tagRepository.findAndCount(findOptions);
    const processedData = await this.enrichTags(data, currentUser);

    return ListUtil.fromFindAndCount([processedData, total], page, limit);
  }

  /**
   * 根据ID查询标签详情
   */
  async findOne(id: number, currentUser?: User) {
    const tag = await this.getTagEntity(id);
    return this.enrichTag(tag, currentUser);
  }

  /**
   * 更新标签
   */
  async update(id: number, updateTagDto: UpdateTagDto, currentUser?: User) {
    const tag = await this.getTagEntity(id);
    Object.assign(tag, updateTagDto);
    const updatedTag = await this.tagRepository.save(tag);
    return {
      success: true,
      message: "response.success.tagUpdate",
      data: await this.enrichTag(updatedTag, currentUser),
    };
  }

  /**
   * 删除标签
   */
  async remove(id: number) {
    const tag = await this.getTagEntity(id);
    await this.tagRepository.remove(tag);
    return { success: true, message: "response.success.tagDelete" };
  }

  /**
   * 增加文章数量
   */
  async incrementArticleCount(id: number) {
    const tag = await this.getTagEntity(id);
    return await this.tagRepository.increment(
      { id: tag.id },
      "articleCount",
      1,
    );
  }

  /**
   * 减少文章数量
   */
  async decrementArticleCount(id: number) {
    const tag = await this.getTagEntity(id);
    if (tag.articleCount > 0) {
      return await this.tagRepository.decrement(
        { id: tag.id },
        "articleCount",
        1,
      );
    }
    return tag;
  }

  /**
   * 关注标签
   */
  async followTag(id: number, userId: number) {
    const tag = await this.getTagEntity(id);

    const existingFollow = await this.tagFollowRepository.findOne({
      where: { tagId: id, userId },
    });

    if (existingFollow) {
      throw new BadRequestException("response.error.tagAlreadyFollowed");
    }

    const tagFollow = this.tagFollowRepository.create({
      tagId: id,
      userId,
    });
    await this.tagFollowRepository.save(tagFollow);

    await this.tagRepository.increment({ id: tag.id }, "followCount", 1);

    return {
      success: true,
      message: "response.success.tagFollow",
      data: await this.enrichTag(
        { ...tag, followCount: tag.followCount + 1 } as Tag,
        { id: userId } as User,
      ),
    };
  }

  /**
   * 取消关注标签
   */
  async unfollowTag(id: number, userId: number) {
    const tag = await this.getTagEntity(id);

    const tagFollow = await this.tagFollowRepository.findOne({
      where: { tagId: id, userId },
    });

    if (!tagFollow) {
      throw new BadRequestException("response.error.tagNotFollowed");
    }

    await this.tagFollowRepository.remove(tagFollow);

    if (tag.followCount > 0) {
      await this.tagRepository.decrement({ id: tag.id }, "followCount", 1);
    }

    return {
      success: true,
      message: "response.success.tagUnfollow",
      data: await this.enrichTag(
        { ...tag, followCount: Math.max(0, tag.followCount - 1) } as Tag,
        { id: userId } as User,
      ),
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

      let tag = await this.findByName(trimmedName);

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

      if (tag && !tags.find((t) => t.id === tag.id)) {
        tags.push(tag as Tag);
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

    return ListUtil.buildSimpleList(await this.enrichTags(data));
  }

  buildEmptyFollowedTagsList(pagination: PaginationDto) {
    const { page, limit } = pagination;
    return ListUtil.buildPaginatedList([], 0, page, limit);
  }

  /**
   * 获取当前用户关注的标签
   */
  async getFollowedTags(
    targetUserId: number,
    pagination: PaginationDto,
    name?: string,
    currentUser?: User,
  ) {
    const { page, limit } = pagination;

    const queryBuilder = this.tagFollowRepository
      .createQueryBuilder("tagFollow")
      .leftJoinAndSelect("tagFollow.tag", "tag")
      .where("tagFollow.userId = :userId", { userId: targetUserId });

    if (name) {
      queryBuilder.andWhere("tag.name LIKE :name", { name: `%${name}%` });
    }

    queryBuilder
      .orderBy("tagFollow.createdAt", "DESC")
      .addOrderBy("tag.sort", "ASC")
      .addOrderBy("tag.createdAt", "DESC");

    const [follows, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const tags = follows
      .map((follow) => follow.tag)
      .filter((tag): tag is Tag => Boolean(tag));

    const processedTags = await this.enrichTags(tags, currentUser);
    return ListUtil.buildPaginatedList(processedTags, total, page, limit);
  }
}
