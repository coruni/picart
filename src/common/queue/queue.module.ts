import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImageAuditProcessor, TextAuditProcessor } from './audit.processor';
import { Upload } from '../../modules/upload/entities/upload.entity';
import { Comment } from '../../modules/comment/entities/comment.entity';
import { Article } from '../../modules/article/entities/article.entity';
import { ContentAuditModule } from '../../modules/content-audit/content-audit.module';

function parseRedisUrl(url: string): { host: string; port: number; password?: string } {
  if (!url) {
    return { host: 'localhost', port: 6379 };
  }
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || '6379', 10),
      password: parsed.password || undefined,
    };
  } catch {
    return { host: 'localhost', port: 6379 };
  }
}

@Module({
  imports: [
    TypeOrmModule.forFeature([Upload, Comment, Article]),
    ContentAuditModule,
    BullModule.forRootAsync({
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get('REDIS_URL');
        const { host, port, password } = parseRedisUrl(redisUrl);
        return {
          redis: {
            host,
            port,
            password,
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
        };
      },
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
