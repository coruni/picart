import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FavoriteService } from './favorite.service';
import { FavoriteController } from './favorite.controller';
import { Favorite } from './entities/favorite.entity';
import { FavoriteItem } from './entities/favorite-item.entity';
import { User } from '../user/entities/user.entity';
import { UserConfig } from '../user/entities/user-config.entity';
import { Article } from '../article/entities/article.entity';
import { ConfigModule } from '../config/config.module';
import { PointsModule } from '../points/points.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Favorite, FavoriteItem, User, UserConfig, Article]),
    ConfigModule,
    PointsModule,
  ],
  controllers: [FavoriteController],
  providers: [FavoriteService],
  exports: [FavoriteService],
})
export class FavoriteModule {}
