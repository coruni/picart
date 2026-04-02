import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArticleService } from './article.service';
import { ArticleController } from './article.controller';
import { Article } from './entities/article.entity';
import { Category } from '../category/entities/category.entity';
import { Tag } from '../tag/entities/tag.entity';
import { ArticleLike } from './entities/article-like.entity';
import { ArticleFavorite } from './entities/article-favorite.entity';
import { Download } from './entities/download.entity';
import { BrowseHistory } from './entities/browse-history.entity';
import { CollectionItem } from '../favorite/entities/collection-item.entity';
import { UserConfig } from '../user/entities/user-config.entity';
import { TagModule } from '../tag/tag.module';
import { UserModule } from '../user/user.module';
import { OrderModule } from '../order/order.module';
import { ConfigModule } from '../config/config.module';
import { MessageModule } from '../message/message.module';
import { CollectionModule } from '../favorite/collection.module';
import { TelegramDownloadService } from './telegram-download.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Article,
      Category,
      Tag,
      ArticleLike,
      ArticleFavorite,
      Download,
      BrowseHistory,
      CollectionItem,
      UserConfig,
    ]),
    TagModule,
    UserModule,
    OrderModule,
    ConfigModule,
    MessageModule,
    CollectionModule,
  ],
  controllers: [ArticleController],
  providers: [ArticleService, TelegramDownloadService],
  exports: [ArticleService],
})
export class ArticleModule { }
