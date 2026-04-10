import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CommentService } from "./comment.service";
import { CommentController } from "./comment.controller";
import { Comment } from "./entities/comment.entity";
import { CommentLike } from "./entities/comment-like.entity";
import { Article } from "../article/entities/article.entity";
import { UserConfig } from "../user/entities/user-config.entity";
import { User } from "../user/entities/user.entity";
import { Upload } from "../upload/entities/upload.entity";
import { MessageModule } from "../message/message.module";
import { ConfigModule } from "../config/config.module";
import { UserModule } from "../user/user.module";
import { ArticlePresentationModule } from "../article/article-presentation.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Comment,
      CommentLike,
      Article,
      UserConfig,
      User,
      Upload,
    ]),
    forwardRef(() => MessageModule),
    ConfigModule,
    forwardRef(() => UserModule),
    forwardRef(() => ArticlePresentationModule),
  ],
  controllers: [CommentController],
  providers: [CommentService],
  exports: [CommentService],
})
export class CommentModule {}
