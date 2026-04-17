import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ArticleService } from "./article.service";
import { ArticleController } from "./article.controller";
import { Article } from "./entities/article.entity";
import { Category } from "../category/entities/category.entity";
import { Tag } from "../tag/entities/tag.entity";
import { ArticleLike } from "./entities/article-like.entity";
import { ArticleFavorite } from "./entities/article-favorite.entity";
import { ArticleDislike } from "./entities/article-dislike.entity";
import { Download } from "./entities/download.entity";
import { BrowseHistory } from "./entities/browse-history.entity";
import { CollectionItem } from "../collection/entities/collection-item.entity";
import { UserConfig } from "../user/entities/user-config.entity";
import { TagModule } from "../tag/tag.module";
import { UserModule } from "../user/user.module";
import { OrderModule } from "../order/order.module";
import { ConfigModule } from "../config/config.module";
import { MessageModule } from "../message/message.module";
import { CollectionModule } from "../collection/collection.module";
import { UploadModule } from "../upload/upload.module";
import { ArticlePresentationModule } from "./article-presentation.module";
import { SearchModule } from "../search/search.module";
import { ContentAuditModule } from "../content-audit/content-audit.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Article,
      Category,
      Tag,
      ArticleLike,
      ArticleFavorite,
      ArticleDislike,
      Download,
      BrowseHistory,
      CollectionItem,
      UserConfig,
    ]),
    TagModule,
    forwardRef(() => UserModule),
    forwardRef(() => OrderModule),
    ConfigModule,
    forwardRef(() => MessageModule),
    forwardRef(() => CollectionModule),
    UploadModule,
    forwardRef(() => ArticlePresentationModule),
    SearchModule.forRoot(),
    ContentAuditModule,
  ],
  controllers: [ArticleController],
  providers: [ArticleService],
  exports: [ArticleService],
})
export class ArticleModule {}
