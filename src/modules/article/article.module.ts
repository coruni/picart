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
import { FavoriteItem } from '../favorite/entities/favorite-item.entity';
import { TagModule } from '../tag/tag.module';
import { UserModule } from '../user/user.module';
import { OrderModule } from '../order/order.module';
import { ConfigModule } from '../config/config.module';
import { MessageModule } from '../message/message.module';
import { FavoriteModule } from '../favorite/favorite.module';

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
      FavoriteItem,
    ]),
    TagModule,
    UserModule,
    OrderModule,
    ConfigModule,
    MessageModule,
    FavoriteModule,
  ],
  controllers: [ArticleController],
  providers: [ArticleService],
  exports: [ArticleService],
})
export class ArticleModule { }