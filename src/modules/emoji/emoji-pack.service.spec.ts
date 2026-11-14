import { BadRequestException } from "@nestjs/common";
import { Repository } from "typeorm";
import { User } from "../user/entities/user.entity";
import { Emoji } from "./entities/emoji.entity";
import { EmojiPackItem } from "./entities/emoji-pack-item.entity";
import { EmojiPack } from "./entities/emoji-pack.entity";
import { EmojiPackService } from "./emoji-pack.service";

describe("EmojiPackService", () => {
  const owner = { id: 7, roles: [] } as unknown as User;

  it("does not expose private emojis through a public pack", async () => {
    const pack = {
      id: 1,
      userId: 7,
      isPublic: true,
      status: "active",
      user: {
        id: 7,
        username: "owner",
        password: "secret",
        userDecorations: [],
      },
      items: [
        {
          id: 1,
          sort: 0,
          emoji: {
            id: 11,
            status: "active",
            isPublic: true,
            type: "user",
            userId: 7,
          },
        },
        {
          id: 2,
          sort: 1,
          emoji: {
            id: 12,
            status: "active",
            isPublic: false,
            type: "user",
            userId: 7,
          },
        },
      ],
    };
    const packRepository = {
      findOne: jest.fn().mockResolvedValue(pack),
    } as unknown as Repository<EmojiPack>;
    const service = new EmojiPackService(
      packRepository,
      {} as Repository<EmojiPackItem>,
      {} as Repository<Emoji>,
    );

    const result = await service.findOne(1);

    expect(result.items.map((item) => item.emoji.id)).toEqual([11]);
    expect(result.user).not.toHaveProperty("password");
  });

  it("rejects private emojis from public packs", async () => {
    const packRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 1,
        userId: owner.id,
        isPublic: true,
        status: "active",
      }),
    } as unknown as Repository<EmojiPack>;
    const packItemRepository = {
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as Repository<EmojiPackItem>;
    const emojiRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 11,
        userId: owner.id,
        isPublic: false,
        type: "user",
        status: "active",
      }),
    } as unknown as Repository<Emoji>;
    const service = new EmojiPackService(
      packRepository,
      packItemRepository,
      emojiRepository,
    );

    await expect(
      service.addEmoji(1, { emojiId: 11, sort: 0 }, owner),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(packItemRepository.save).not.toHaveBeenCalled();
  });
});
