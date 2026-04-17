import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImageAuditProcessor, TextAuditProcessor } from './audit.processor';
import { Upload } from '../../modules/upload/entities/upload.entity';
import { Comment } from '../../modules/comment/entities/comment.entity';
import { Article } from '../../modules/article/entities/article.entity';
import { ContentAuditModule } from '../../modules/content-audit/content-audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Upload, Comment, Article]),
    ContentAuditModule,
    BullModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
          password: configService.get('REDIS_PASSWORD'),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: 'image-audit',
    }),
    BullModule.registerQueue({
      name: 'text-audit',
    }),
  ],
  providers: [ImageAuditProcessor, TextAuditProcessor],
  exports: [BullModule],
})
export class QueueModule {}
