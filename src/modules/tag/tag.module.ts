import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TagService } from "./tag.service";
import { TagController } from "./tag.controller";
import { Tag } from "./entities/tag.entity";
import { TagFollow } from "./entities/tag-follow.entity";
import { Article } from "../article/entities/article.entity";
import { UserConfig } from "../user/entities/user-config.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Tag, TagFollow, Article, UserConfig])],
  controllers: [TagController],
  providers: [TagService],
  exports: [TagService],
})
export class TagModule {}
