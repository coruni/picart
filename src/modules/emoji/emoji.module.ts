import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { Emoji } from './entities/emoji.entity';
import { EmojiFavorite } from './entities/emoji-favorite.entity';
import { EmojiService } from './emoji.service';
import { EmojiController } from './emoji.controller';
import { User } from '../user/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Emoji, EmojiFavorite, User]),
    MulterModule.register({
      storage: diskStorage({
        destination: './uploads/emoji',
        filename: (req, file, cb) => {
          const randomName = Array(32)
            .fill(null)
            .map(() => Math.round(Math.random() * 16).toString(16))
            .join('');
          cb(null, `${randomName}${extname(file.originalname)}`);
        },
      }),
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  ],
  providers: [EmojiService],
  controllers: [EmojiController],
  exports: [EmojiService],
})
export class EmojiModule {}
