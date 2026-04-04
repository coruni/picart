import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import { Emoji } from "./entities/emoji.entity";
import { EmojiFavorite } from "./entities/emoji-favorite.entity";
import { CreateEmojiDto } from "./dto/create-emoji.dto";
import { UpdateEmojiDto } from "./dto/update-emoji.dto";
import { QueryEmojiDto } from "./dto/query-emoji.dto";
import { User } from "../user/entities/user.entity";
import { ListUtil } from "src/common/utils/list.util";
import { PermissionUtil } from "src/common/utils/permission.util";
import { sanitizeUser, processUserDecorations } from "src/common/utils";

@Injectable()
export class EmojiService {
  constructor(
    @InjectRepository(Emoji)
    private readonly emojiRepository: Repository<Emoji>,
    @InjectRepository(EmojiFavorite)
    private readonly emojiFavoriteRepository: Repository<EmojiFavorite>,
  ) {}

  private getGroupName(emoji: Emoji): string {
    const category = emoji.category?.trim();
    if (category) {
      return category;
    }
    return emoji.type === "system" ? "system" : "ungrouped";
  }

  private buildGroupedEmojiData(emojis: any[]) {
    const groupMap = new Map<string, any[]>();

    for (const emoji of emojis) {
      const groupName = this.getGroupName(emoji);
      if (!groupMap.has(groupName)) {
        groupMap.set(groupName, []);
      }
      groupMap.get(groupName)!.push(emoji);
    }

    const groups = Array.from(groupMap.entries()).map(([name, items]) => ({
      name,
      count: items.length,
      items,
    }));

    return {
      groups,
      groupCount: groups.length,
      total: emojis.length,
    };
  }

  async create(createEmojiDto: CreateEmojiDto, user: User) {
    if (
      createEmojiDto.type === "system" &&
      !PermissionUtil.hasPermission(user, "emoji:manage")
    ) {
      throw new ForbiddenException(
        "response.error.noPermissionCreateSystemEmoji",
      );
    }

    if (createEmojiDto.code) {
      const existingEmoji = await this.emojiRepository.findOne({
        where: { code: createEmojiDto.code },
      });
      if (existingEmoji) {
        throw new BadRequestException("response.error.emojiCodeExists");
      }
    }

    const emoji = this.emojiRepository.create({
      ...createEmojiDto,
      userId: createEmojiDto.type === "system" ? null : user.id,
      type: createEmojiDto.type || "user",
    });

    const savedEmoji = await this.emojiRepository.save(emoji);

    return {
      success: true,
      message: "response.success.emojiCreate",
      data: savedEmoji,
    };
  }

  async findAll(queryDto: QueryEmojiDto, user?: User) {
    const {
      page,
      limit,
      grouped = true,
      type,
      category,
      keyword,
      isPublic,
      status,
      userId,
      onlyFavorites,
      sortBy,
      sortOrder,
    } = queryDto;

    const queryBuilder = this.emojiRepository
      .createQueryBuilder("emoji")
      .leftJoinAndSelect("emoji.user", "user")
      .leftJoinAndSelect("user.userDecorations", "userDecorations")
      .leftJoinAndSelect("userDecorations.decoration", "decoration");

    if (type) {
      queryBuilder.andWhere("emoji.type = :type", { type });
    }

    if (category) {
      queryBuilder.andWhere("emoji.category = :category", { category });
    }

    if (status) {
      queryBuilder.andWhere("emoji.status = :status", { status });
    } else {
      queryBuilder.andWhere("emoji.status = :status", { status: "active" });
    }

    if (keyword) {
      queryBuilder.andWhere(
        "(emoji.name LIKE :keyword OR emoji.tags LIKE :keyword OR emoji.code LIKE :keyword)",
        { keyword: `%${keyword}%` },
      );
    }

    if (isPublic !== undefined) {
      queryBuilder.andWhere("emoji.isPublic = :isPublic", { isPublic });
    }

    if (userId) {
      queryBuilder.andWhere("emoji.userId = :userId", {
        userId: parseInt(userId),
      });
    }

    if (onlyFavorites && user) {
      const favorites = await this.emojiFavoriteRepository.find({
        where: { userId: user.id },
        select: ["emojiId"],
      });
      const favoriteIds = favorites.map((f) => f.emojiId);

      if (favoriteIds.length > 0) {
        queryBuilder.andWhere("emoji.id IN (:...favoriteIds)", { favoriteIds });
      } else {
        if (grouped) {
          return {
            groups: [],
            groupCount: 0,
            total: 0,
          };
        }
        return ListUtil.buildPaginatedList([], 0, page, limit);
      }
    }

    if (!user || !PermissionUtil.hasPermission(user, "emoji:manage")) {
      queryBuilder.andWhere(
        "(emoji.isPublic = :isPublic OR emoji.userId = :currentUserId OR emoji.type = :systemType)",
        {
          isPublic: true,
          currentUserId: user?.id || null,
          systemType: "system",
        },
      );
    }

    if (
      sortBy === "createdAt" &&
      (sortOrder === "ASC" || sortOrder === "DESC")
    ) {
      queryBuilder.orderBy("emoji.createdAt", sortOrder);
    } else {
      queryBuilder.orderBy("emoji.useCount", "DESC");
      queryBuilder.addOrderBy("emoji.createdAt", "DESC");
    }

    let emojis: Emoji[] = [];
    let total = 0;

    if (grouped) {
      emojis = await queryBuilder.getMany();
      total = emojis.length;
    } else {
      [emojis, total] = await queryBuilder
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();
    }

    const processedEmojis = emojis.map((emoji) => ({
      ...emoji,
      user: emoji.user
        ? sanitizeUser(processUserDecorations(emoji.user))
        : null,
    }));

    if (user && processedEmojis.length > 0) {
      const favorites = await this.emojiFavoriteRepository.find({
        where: {
          userId: user.id,
          emojiId: In(processedEmojis.map((e) => e.id)),
        },
      });
      const favoriteIds = new Set(favorites.map((f) => f.emojiId));

      processedEmojis.forEach((emoji: any) => {
        emoji.isFavorite = favoriteIds.has(emoji.id);
      });
    }

    if (grouped) {
      return this.buildGroupedEmojiData(processedEmojis);
    }

    return ListUtil.buildPaginatedList(processedEmojis, total, page, limit);
  }

  async findOne(id: number, user?: User) {
    const emoji = await this.emojiRepository.findOne({
      where: { id },
      relations: [
        "user",
        "user.userDecorations",
        "user.userDecorations.decoration",
      ],
    });

    if (!emoji) {
      throw new NotFoundException("response.error.emojiNotFound");
    }

    if (
      !emoji.isPublic &&
      emoji.type !== "system" &&
      (!user ||
        (emoji.userId !== user.id &&
          !PermissionUtil.hasPermission(user, "emoji:manage")))
    ) {
      throw new ForbiddenException("response.error.noPermissionViewEmoji");
    }

    const processedEmoji: any = {
      ...emoji,
      user: emoji.user
        ? sanitizeUser(processUserDecorations(emoji.user))
        : null,
    };

    if (user) {
      const favorite = await this.emojiFavoriteRepository.findOne({
        where: { userId: user.id, emojiId: id },
      });
      processedEmoji.isFavorite = !!favorite;
    }

    return processedEmoji;
  }

  async update(id: number, updateEmojiDto: UpdateEmojiDto, user: User) {
    const emoji = await this.emojiRepository.findOne({ where: { id } });

    if (!emoji) {
      throw new NotFoundException("response.error.emojiNotFound");
    }

    if (
      emoji.userId !== user.id &&
      !PermissionUtil.hasPermission(user, "emoji:manage")
    ) {
      throw new ForbiddenException("response.error.noPermissionUpdateEmoji");
    }

    if (updateEmojiDto.code && updateEmojiDto.code !== emoji.code) {
      const existingEmoji = await this.emojiRepository.findOne({
        where: { code: updateEmojiDto.code },
      });
      if (existingEmoji && existingEmoji.id !== id) {
        throw new BadRequestException("response.error.emojiCodeExists");
      }
    }

    await this.emojiRepository.update(id, updateEmojiDto);
    const updatedEmoji = await this.findOne(id, user);

    return {
      success: true,
      message: "response.success.emojiUpdate",
      data: updatedEmoji,
    };
  }

  async remove(id: number, user: User) {
    const emoji = await this.emojiRepository.findOne({ where: { id } });

    if (!emoji) {
      throw new NotFoundException("response.error.emojiNotFound");
    }

    if (
      emoji.userId !== user.id &&
      !PermissionUtil.hasPermission(user, "emoji:manage")
    ) {
      throw new ForbiddenException("response.error.noPermissionDeleteEmoji");
    }

    await this.emojiRepository.update(id, { status: "deleted" });

    return {
      success: true,
      message: "response.success.emojiDelete",
    };
  }

  async addToFavorites(emojiId: number, user: User) {
    const emoji = await this.emojiRepository.findOne({
      where: { id: emojiId },
    });

    if (!emoji) {
      throw new NotFoundException("response.error.emojiNotFound");
    }

    const existingFavorite = await this.emojiFavoriteRepository.findOne({
      where: { userId: user.id, emojiId },
    });

    if (existingFavorite) {
      throw new BadRequestException("response.error.emojiAlreadyFavorited");
    }

    await this.emojiFavoriteRepository.save({
      userId: user.id,
      emojiId,
    });

    return {
      success: true,
      message: "response.success.emojiAddToFavorites",
    };
  }

  async removeFromFavorites(emojiId: number, user: User) {
    const favorite = await this.emojiFavoriteRepository.findOne({
      where: { userId: user.id, emojiId },
    });

    if (!favorite) {
      throw new NotFoundException("response.error.emojiFavoriteNotFound");
    }

    await this.emojiFavoriteRepository.delete(favorite.id);

    return {
      success: true,
      message: "response.success.emojiRemoveFromFavorites",
    };
  }

  async getFavorites(user: User, page: number = 1, limit: number = 20) {
    const favorites = await this.emojiFavoriteRepository.find({
      where: { userId: user.id },
      relations: [
        "emoji",
        "emoji.user",
        "emoji.user.userDecorations",
        "emoji.user.userDecorations.decoration",
      ],
      order: { createdAt: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
    });

    const total = await this.emojiFavoriteRepository.count({
      where: { userId: user.id },
    });

    const emojis = favorites.map((f) => ({
      ...f.emoji,
      user: f.emoji.user
        ? sanitizeUser(processUserDecorations(f.emoji.user))
        : null,
      isFavorite: true,
      favoritedAt: f.createdAt,
    }));

    return ListUtil.buildPaginatedList(emojis, total, page, limit);
  }

  async incrementUseCount(id: number) {
    await this.emojiRepository.increment({ id }, "useCount", 1);
  }

  async getCategories() {
    const result = await this.emojiRepository
      .createQueryBuilder("emoji")
      .select("emoji.category", "category")
      .addSelect("COUNT(*)", "count")
      .where("emoji.status = :status", { status: "active" })
      .andWhere("emoji.category IS NOT NULL")
      .groupBy("emoji.category")
      .orderBy("count", "DESC")
      .getRawMany();

    return result;
  }

  async getPopular(limit: number = 20) {
    const emojis = await this.emojiRepository.find({
      where: { status: "active", isPublic: true },
      relations: [
        "user",
        "user.userDecorations",
        "user.userDecorations.decoration",
      ],
      order: { useCount: "DESC" },
      take: limit,
    });

    return emojis.map((emoji) => ({
      ...emoji,
      user: emoji.user
        ? sanitizeUser(processUserDecorations(emoji.user))
        : null,
    }));
  }

  async getRecent(user: User, limit: number = 20) {
    const emojis = await this.emojiRepository.find({
      where: { userId: user.id, status: "active" },
      relations: [
        "user",
        "user.userDecorations",
        "user.userDecorations.decoration",
      ],
      order: { createdAt: "DESC" },
      take: limit,
    });

    return emojis.map((emoji) => ({
      ...emoji,
      user: emoji.user
        ? sanitizeUser(processUserDecorations(emoji.user))
        : null,
    }));
  }
}
