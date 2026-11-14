import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { QueryFailedError, Repository } from "typeorm";
import { ListUtil } from "src/common/utils/list.util";
import { PermissionUtil } from "src/common/utils/permission.util";
import { sanitizeUser, processUserDecorations } from "src/common/utils";
import { User } from "../user/entities/user.entity";
import { Emoji } from "./entities/emoji.entity";
import { EmojiPackItem } from "./entities/emoji-pack-item.entity";
import { EmojiPack } from "./entities/emoji-pack.entity";
import { AddEmojiToPackDto } from "./dto/add-emoji-to-pack.dto";
import { CreateEmojiPackDto } from "./dto/create-emoji-pack.dto";
import { QueryEmojiPackDto } from "./dto/query-emoji-pack.dto";
import { UpdateEmojiPackItemDto } from "./dto/update-emoji-pack-item.dto";
import { UpdateEmojiPackDto } from "./dto/update-emoji-pack.dto";

@Injectable()
export class EmojiPackService {
  constructor(
    @InjectRepository(EmojiPack)
    private readonly packRepository: Repository<EmojiPack>,
    @InjectRepository(EmojiPackItem)
    private readonly packItemRepository: Repository<EmojiPackItem>,
    @InjectRepository(Emoji)
    private readonly emojiRepository: Repository<Emoji>,
  ) {}

  async create(dto: CreateEmojiPackDto, user: User) {
    const pack = this.packRepository.create({
      ...dto,
      userId: user.id,
    });
    const savedPack = await this.packRepository.save(pack);
    return { success: true, data: savedPack };
  }

  async findAll(query: QueryEmojiPackDto, user?: User) {
    const { page, limit, keyword } = query;
    const builder = this.packRepository
      .createQueryBuilder("pack")
      .where("pack.status = :status", { status: "active" });

    if (user) {
      builder.andWhere("(pack.isPublic = :isPublic OR pack.userId = :userId)", {
        isPublic: true,
        userId: user.id,
      });
    } else {
      builder.andWhere("pack.isPublic = :isPublic", { isPublic: true });
    }

    if (keyword) {
      builder.andWhere(
        "(pack.name LIKE :keyword OR pack.description LIKE :keyword)",
        { keyword: `%${keyword}%` },
      );
    }

    builder
      .loadRelationCountAndMap(
        "pack.itemCount",
        "pack.items",
        "packItem",
        (itemBuilder) =>
          itemBuilder
            .innerJoin("packItem.emoji", "emoji")
            .where("emoji.status = :emojiStatus", { emojiStatus: "active" }),
      )
      .orderBy("pack.createdAt", "DESC")
      .skip((page - 1) * limit)
      .take(limit);

    const [packs, total] = await builder.getManyAndCount();
    return ListUtil.buildPaginatedList(packs, total, page, limit);
  }

  async findOne(id: number, user?: User) {
    const pack = await this.packRepository.findOne({
      where: { id, status: "active" },
      relations: [
        "user",
        "user.userDecorations",
        "user.userDecorations.decoration",
        "items",
        "items.emoji",
      ],
    });

    if (!pack) {
      throw new NotFoundException("response.error.emojiPackNotFound");
    }

    if (
      !pack.isPublic &&
      pack.userId !== user?.id &&
      !PermissionUtil.hasPermission(user, "emoji:manage")
    ) {
      throw new ForbiddenException("response.error.noPermissionViewEmojiPack");
    }

    pack.items = (pack.items || [])
      .filter(
        ({ emoji }) =>
          emoji?.status === "active" &&
          (emoji.isPublic ||
            emoji.type === "system" ||
            emoji.userId === user?.id ||
            PermissionUtil.hasPermission(user, "emoji:manage")),
      )
      .sort((a, b) => a.sort - b.sort || a.id - b.id);
    pack.user = pack.user
      ? sanitizeUser(processUserDecorations(pack.user))
      : null;

    return pack;
  }

  async update(id: number, dto: UpdateEmojiPackDto, user: User) {
    const pack = await this.getEditablePack(id, user);
    if (dto.isPublic === true && !pack.isPublic) {
      const privateItemCount = await this.packItemRepository
        .createQueryBuilder("packItem")
        .innerJoin("packItem.emoji", "emoji")
        .where("packItem.packId = :packId", { packId: id })
        .andWhere("emoji.status = :status", { status: "active" })
        .andWhere("emoji.isPublic = :isPublic", { isPublic: false })
        .andWhere("emoji.type != :type", { type: "system" })
        .getCount();

      if (privateItemCount > 0) {
        throw new BadRequestException(
          "response.error.emojiPackContainsPrivateEmojis",
        );
      }
    }

    await this.packRepository.update(id, dto);
    return {
      success: true,
      data: await this.findOne(id, user),
    };
  }

  async remove(id: number, user: User) {
    await this.getEditablePack(id, user);
    await this.packRepository.update(id, { status: "deleted" });
    return { success: true, message: "response.success.emojiPackDelete" };
  }

  async addEmoji(id: number, dto: AddEmojiToPackDto, user: User) {
    const pack = await this.getEditablePack(id, user);
    const emoji = await this.emojiRepository.findOne({
      where: { id: dto.emojiId },
    });

    if (!emoji || emoji.status !== "active") {
      throw new NotFoundException("response.error.emojiNotFound");
    }

    if (
      !emoji.isPublic &&
      emoji.type !== "system" &&
      emoji.userId !== user.id &&
      !PermissionUtil.hasPermission(user, "emoji:manage")
    ) {
      throw new ForbiddenException("response.error.noPermissionViewEmoji");
    }

    if (pack.isPublic && !emoji.isPublic && emoji.type !== "system") {
      throw new BadRequestException(
        "response.error.emojiPackContainsPrivateEmojis",
      );
    }

    const packItem = this.packItemRepository.create({
      packId: id,
      emojiId: emoji.id,
      sort: dto.sort,
    });

    try {
      await this.packItemRepository.save(packItem);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        error.driverError?.code === "ER_DUP_ENTRY"
      ) {
        throw new BadRequestException("response.error.emojiAlreadyInPack");
      }
      throw error;
    }

    return { success: true, message: "response.success.emojiPackAddEmoji" };
  }

  async removeEmoji(id: number, emojiId: number, user: User) {
    await this.getEditablePack(id, user);
    const result = await this.packItemRepository.delete({
      packId: id,
      emojiId,
    });

    if (!result.affected) {
      throw new NotFoundException("response.error.emojiNotInPack");
    }

    return { success: true, message: "response.success.emojiPackRemoveEmoji" };
  }

  async updateEmojiSort(
    id: number,
    emojiId: number,
    dto: UpdateEmojiPackItemDto,
    user: User,
  ) {
    await this.getEditablePack(id, user);
    const result = await this.packItemRepository.update(
      { packId: id, emojiId },
      { sort: dto.sort },
    );

    if (!result.affected) {
      throw new NotFoundException("response.error.emojiNotInPack");
    }

    return { success: true, message: "response.success.emojiPackSortUpdated" };
  }

  private async getEditablePack(id: number, user: User) {
    const pack = await this.packRepository.findOne({
      where: { id, status: "active" },
    });

    if (!pack) {
      throw new NotFoundException("response.error.emojiPackNotFound");
    }

    if (
      pack.userId !== user.id &&
      !PermissionUtil.hasPermission(user, "emoji:manage")
    ) {
      throw new ForbiddenException(
        "response.error.noPermissionUpdateEmojiPack",
      );
    }

    return pack;
  }
}
