import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CollectionService } from "./collection.service";
import { CollectionController } from "./collection.controller";
import { Collection } from "./entities/collection.entity";
import { CollectionItem } from "./entities/collection-item.entity";
import { User } from "../user/entities/user.entity";
import { UserConfig } from "../user/entities/user-config.entity";
import { Article } from "../article/entities/article.entity";
import { ConfigModule } from "../config/config.module";
import { PointsModule } from "../points/points.module";
import { ArticlePresentationModule } from "../article/article-presentation.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Collection,
      CollectionItem,
      User,
      UserConfig,
      Article,
    ]),
    ConfigModule,
    PointsModule,
    forwardRef(() => ArticlePresentationModule),
  ],
  controllers: [CollectionController],
  providers: [CollectionService],
  exports: [CollectionService],
})
export class CollectionModule {}
