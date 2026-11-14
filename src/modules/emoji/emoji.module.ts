import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MulterModule } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname } from "path";
import { Emoji } from "./entities/emoji.entity";
import { EmojiFavorite } from "./entities/emoji-favorite.entity";
import { EmojiPack } from "./entities/emoji-pack.entity";
import { EmojiPackItem } from "./entities/emoji-pack-item.entity";
import { EmojiService } from "./emoji.service";
import { EmojiController } from "./emoji.controller";
import { EmojiPackService } from "./emoji-pack.service";
import { EmojiPackController } from "./emoji-pack.controller";
import { User } from "../user/entities/user.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Emoji,
      EmojiFavorite,
      EmojiPack,
      EmojiPackItem,
      User,
    ]),
    MulterModule.register({
      storage: diskStorage({
        destination: "./uploads/emoji",
        filename: (req, file, cb) => {
          const randomName = Array(32)
            .fill(null)
            .map(() => Math.round(Math.random() * 16).toString(16))
            .join("");
          cb(null, `${randomName}${extname(file.originalname)}`);
        },
      }),
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  ],
  providers: [EmojiService, EmojiPackService],
  controllers: [EmojiController, EmojiPackController],
  exports: [EmojiService],
})
export class EmojiModule {}
