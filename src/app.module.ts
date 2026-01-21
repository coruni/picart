import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './modules/user/user.module';
import { RoleModule } from './modules/role/role.module';
import { PermissionModule } from './modules/permission/permission.module';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule as ConfigDatabaseModule } from './modules/config/config.module';
import { ArticleModule } from './modules/article/article.module';
import { CommentModule } from './modules/comment/comment.module';
import { TagModule } from './modules/tag/tag.module';
import { CategoryModule } from './modules/category/category.module';
import { OrderModule } from './modules/order/order.module';
import { InviteModule } from './modules/invite/invite.module';
import { PaymentModule } from './modules/payment/payment.module';
import { databaseConfig, cacheConfig, mailerConfig } from './config';
import { UploadModule } from './modules/upload/upload.module';
import { MailerModule } from '@nestjs-modules/mailer';
import { MessageModule } from './modules/message/message.module';
import { BannerModule } from './modules/banner/banner.module';
import { ReportModule } from './modules/report/report.module';
import { DecorationModule } from './modules/decoration/decoration.module';
import { EmojiModule } from './modules/emoji/emoji.module';
import { PointsModule } from './modules/points/points.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { FavoriteModule } from './modules/favorite/favorite.module';
import { AchievementModule } from './modules/achievement/achievement.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: databaseConfig,
      inject: [ConfigService],
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: cacheConfig,
      inject: [ConfigService],
    }),
    EventEmitterModule.forRoot(),
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: mailerConfig,
      inject: [ConfigService],
    }),
    PermissionModule,
    RoleModule,
    ConfigDatabaseModule,
    UserModule,
    ArticleModule,
    CommentModule,
    TagModule,
    CategoryModule,
    OrderModule,
    InviteModule,
    PaymentModule,
    UploadModule,
    MessageModule,
    BannerModule,
    ReportModule,
    DecorationModule,
    EmojiModule,
    PointsModule,
    FavoriteModule,
    AchievementModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
