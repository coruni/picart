import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommentService } from './comment.service';
import { CommentController } from './comment.controller';
import { Comment } from './entities/comment.entity';
import { CommentLike } from './entities/comment-like.entity';
import { Article } from '../article/entities/article.entity';
import { UserConfig } from '../user/entities/user-config.entity';
import { User } from '../user/entities/user.entity';
import { MessageModule } from '../message/message.module';
import { ConfigModule } from '../config/config.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Comment, CommentLike, Article, UserConfig, User]),
    MessageModule,
    ConfigModule
  ],
  controllers: [CommentController],
  providers: [CommentService],
  exports: [CommentService],
})
export class CommentModule {}
