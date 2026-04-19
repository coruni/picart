import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImageAuditProcessor, TextAuditProcessor } from './audit.processor';
import { VideoCompressionProcessor } from './video-compression.processor';
import { Upload } from '../../modules/upload/entities/upload.entity';
import { Comment } from '../../modules/comment/entities/comment.entity';
import { Article } from '../../modules/article/entities/article.entity';
import { ContentAuditModule } from '../../modules/content-audit/content-audit.module';
import { User } from '../../modules/user/entities/user.entity';
import { Category } from '../../modules/category/entities/category.entity';
import { Tag } from '../../modules/tag/entities/tag.entity';

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
    TypeOrmModule.forFeature([Upload, Comment, Article, User, Category, Tag]),
    ContentAuditModule,
    BullModule.forRootAsync({
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get('REDIS_URL');
        const redisPassword = configService.get('REDIS_PASSWORD');
        const { host, port, password: urlPassword } = parseRedisUrl(redisUrl);
        // 优先使用环境变量 REDIS_PASSWORD，其次从 URL 解析
        const password = redisPassword || urlPassword;
        return {
          redis: {
            host,
            port,
            password,
            // 启用 keepAlive 保持连接
            keepAlive: 30000,
            // 连接重试配置
            retryStrategy: (times: number) => {
              return Math.min(times * 50, 2000);
            },
          },
          // 默认作业选项 - 增强持久化配置
          defaultJobOptions: {
            // 重试次数
            attempts: 5,
            // 退避策略 - 指数退避
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
            // 任务超时时间（5分钟）
            timeout: 300000,
            // 失败时保留作业（用于重启后继续处理）
            removeOnFail: false,
            // 成功完成时保留最近100个
            removeOnComplete: 100,
            //  stalled 作业检查间隔（30秒）
            stalledInterval: 30000,
          },
          // 队列配置
          settings: {
            // 锁续期时间（任务处理中需要续期，防止被标记为 stalled）
            lockDuration: 30000,
            //  stalled 作业阈值（超过此时间未更新进度的任务会被重新处理）
            stalledCheckInterval: 30000,
            // 最大处理时间（5分钟）
            maxLen: 0,
          },
        };
      },
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: 'image-audit',
      // 图片审核队列专用配置
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        timeout: 60000,
        removeOnFail: false,
        removeOnComplete: 100,
      },
    }),
    BullModule.registerQueue({
      name: 'text-audit',
      // 文本审核队列专用配置
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 3000,
        },
        timeout: 30000,
        removeOnFail: false,
        removeOnComplete: 100,
      },
    }),
    BullModule.registerQueue({
      name: 'video-compression',
      // 视频压缩队列专用配置 - 闲时处理，较长的超时时间
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 10000,
        },
        // 视频压缩可能需要较长时间（大文件）
        timeout: 600000, // 10分钟
        removeOnFail: false,
        removeOnComplete: 50,
      },
    }),
  ],
  providers: [ImageAuditProcessor, TextAuditProcessor, VideoCompressionProcessor],
  exports: [BullModule],
})
export class QueueModule {}
