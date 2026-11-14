import { Repository } from "typeorm";
import { Emoji } from "./entities/emoji.entity";
import { EmojiFavorite } from "./entities/emoji-favorite.entity";
import { EmojiService } from "./emoji.service";

describe("EmojiService grouped pagination", () => {
  it("applies pagination before grouping and returns total-page metadata", async () => {
    const queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 25]),
    };
    const emojiRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    } as unknown as Repository<Emoji>;
    const service = new EmojiService(
      emojiRepository,
      {} as Repository<EmojiFavorite>,
    );

    const result = await service.findAll({
      page: 2,
      limit: 10,
      grouped: true,
    });

    expect(queryBuilder.skip).toHaveBeenCalledWith(10);
    expect(queryBuilder.take).toHaveBeenCalledWith(10);
    expect(result).toMatchObject({
      groups: [],
      total: 25,
      meta: { page: 2, limit: 10, totalPages: 3 },
    });
  });
});
