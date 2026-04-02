import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArticleLike } from './entities/article-like.entity';
import { ArticleFavorite } from './entities/article-favorite.entity';
import { Category } from '../category/entities/category.entity';
import { ConfigModule } from '../config/config.module';
import { UserModule } from '../user/user.module';
import { OrderModule } from '../order/order.module';
import { ArticlePresentationService } from './article-presentation.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ArticleLike, ArticleFavorite, Category]),
    ConfigModule,
    UserModule,
    OrderModule,
  ],
  providers: [ArticlePresentationService],
  exports: [ArticlePresentationService],
})
export class ArticlePresentationModule {}
