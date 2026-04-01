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
import { UserConfig } from "../user/entities/user-config.entity";
import { ListUtil, PermissionUtil, processUserDecorations, sanitizeUser } from "src/common/utils";
import { Article } from "../article/entities/article.entity";

@Injectable()
export class TagService {
  private static readonly RECENT_ARTICLE_DAYS = 7;
  private static readonly RANDOM_USERS_PER_TAG = 3;
  private static readonly FOLLOW_SAMPLING_MULTIPLIER = 8;

  constructor(
    @InjectRepository(Tag)
    private tagRepository: Repository<Tag>,
    @InjectRepository(TagFollow)
    private tagFollowRepository: Repository<TagFollow>,
    @InjectRepository(UserConfig)
    private userConfigRepository: Repository<UserConfig>,
    @InjectRepository(Article)
    private articleRepository: Repository<Article>,
  ) {}

  private canBypassUserVisibility(targetUserId: number, currentUser?: User) {
    if (!currentUser) {
      return false;
    }

    return (
      currentUser.id === targetUserId ||
      PermissionUtil.hasPermission(currentUser, "user:manage")
    );
  }

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

  private async getRandomUsersMap(tagIds: number[]) {
    const maxRows =
      tagIds.length *
      TagService.RANDOM_USERS_PER_TAG *
      TagService.FOLLOW_SAMPLING_MULTIPLIER;

    const sampledFollows = await this.tagFollowRepository.find({
      where: { tagId: In(tagIds) },
      relations: [
        "user",
        "user.userDecorations",
        "user.userDecorations.decoration",
      ],
      order: {
        createdAt: "DESC",
      },
      take: maxRows,
    });

    const perTagCandidates = new Map<number, TagFollow[]>();
    for (const follow of sampledFollows) {
      if (!follow.user) {
        continue;
      }

      const candidates = perTagCandidates.get(follow.tagId) || [];
      if (
        candidates.length >=
        TagService.RANDOM_USERS_PER_TAG * TagService.FOLLOW_SAMPLING_MULTIPLIER
      ) {
        continue;
      }

      candidates.push(follow);
      perTagCandidates.set(follow.tagId, candidates);
    }

    const randomUsersMap = new Map<number, any[]>();
    for (const tagId of tagIds) {
      const candidates = perTagCandidates.get(tagId) || [];
      const users = this.shuffleArray(candidates)
        .slice(0, TagService.RANDOM_USERS_PER_TAG)
        .map((follow) => sanitizeUser(processUserDecorations(follow.user)));

      randomUsersMap.set(tagId, users);
    }

    return randomUsersMap;
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

    const randomUsersMap = await this.getRandomUsersMap(tagIds);

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

  async create(createTagDto: CreateTagDto) {
    const tag = this.tagRepository.create(createTagDto);
    const savedTag = await this.tagRepository.save(tag);
    return {
      success: true,
      message: "response.success.tagCreate",
      data: await this.enrichTag(savedTag),
    };
  }

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

  async findOne(id: number, currentUser?: User) {
    const tag = await this.getTagEntity(id);
    return this.enrichTag(tag, currentUser);
  }

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

  async remove(id: number) {
    const tag = await this.getTagEntity(id);
    await this.tagRepository.remove(tag);
    return { success: true, message: "response.success.tagDelete" };
  }

  async incrementArticleCount(id: number) {
    const tag = await this.getTagEntity(id);
    return await this.tagRepository.increment(
      { id: tag.id },
      "articleCount",
      1,
    );
  }

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

  async isFollowing(tagId: number, userId: number): Promise<boolean> {
    const count = await this.tagFollowRepository.count({
      where: { tagId, userId },
    });
    return count > 0;
  }

  async findByName(name: string) {
    return await this.tagRepository.findOne({
      where: { name: name.trim() },
    });
  }

  async findOrCreateTags(tagNames: string[]) {
    const normalizedNames = [
      ...new Set(tagNames.map((tagName) => tagName.trim()).filter(Boolean)),
    ];
    if (!normalizedNames.length) {
      return [];
    }

    const existingTags = await this.tagRepository.find({
      where: { name: In(normalizedNames) },
    });

    const existingNameSet = new Set(existingTags.map((tag) => tag.name));
    const missingNames = normalizedNames.filter(
      (name) => !existingNameSet.has(name),
    );

    if (missingNames.length) {
      await this.tagRepository
        .createQueryBuilder()
        .insert()
        .into(Tag)
        .values(
          missingNames.map((name) => ({
            name,
            description: `自动创建的标签 ${name}`,
            avatar: "",
            background: "",
            cover: "",
            sort: 0,
          })),
        )
        .orIgnore()
        .execute();
    }

    const allTags = await this.tagRepository.find({
      where: { name: In(normalizedNames) },
    });

    const tagMap = new Map(allTags.map((tag) => [tag.name, tag]));
    return normalizedNames
      .map((name) => tagMap.get(name))
      .filter((tag): tag is Tag => Boolean(tag));
  }

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

  async getFollowedTags(
    targetUserId: number,
    pagination: PaginationDto,
    name?: string,
    currentUser?: User,
  ) {
    const { page, limit } = pagination;

    if (!this.canBypassUserVisibility(targetUserId, currentUser)) {
      const targetUserConfig = await this.userConfigRepository.findOne({
        where: { userId: targetUserId },
      });

      if (targetUserConfig?.hideTags) {
        return ListUtil.buildPaginatedList([], 0, page, limit);
      }
    }

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
