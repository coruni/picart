import { Processor, Process, InjectQueue, OnQueueFailed, OnQueueStalled, OnQueueCompleted, OnQueueWaiting } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Upload, UploadStorageType } from '../../modules/upload/entities/upload.entity';
import { Comment } from '../../modules/comment/entities/comment.entity';
import { Article } from '../../modules/article/entities/article.entity';
import { ContentAuditService } from '../../modules/content-audit/content-audit.service';
import { AuditResult } from '../../modules/content-audit/dto/audit.dto';
import { User } from '../../modules/user/entities/user.entity';
import { Category } from '../../modules/category/entities/category.entity';
import { Tag } from '../../modules/tag/entities/tag.entity';
import * as fs from 'fs';
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { ConfigService } from '@nestjs/config';

interface ImageAuditJob {
  uploadId: number;
  url: string;
  hash: string;
  userId?: number;
  baseUrl?: string;
}

interface TextAuditJob {
  type: 'comment' | 'article';
  id: number;
  content: string;
  userId?: number;
  images?: string[];
}

@Processor('image-audit')
export class ImageAuditProcessor {
  private readonly logger = new Logger(ImageAuditProcessor.name);
  private s3Client: S3Client;

  constructor(
    @InjectRepository(Upload)
    private uploadRepository: Repository<Upload>,
    private contentAuditService: ContentAuditService,
    private configService: ConfigService,
    @InjectQueue('image-audit') private imageAuditQueue: Queue,
  ) {
    this.initS3Client();
  }

  private initS3Client() {
    const storageType = this.configService.get('MULTER_STORAGE', 'local');
    if (storageType !== 's3') return;

    const region = this.configService.get('AWS_REGION', 'us-east-1');
    const accessKeyId = this.configService.get('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get('AWS_SECRET_ACCESS_KEY');
    const endpoint = this.configService.get('AWS_ENDPOINT');
    const forcePathStyle = this.configService.get('AWS_FORCE_PATH_STYLE') === 'true';

    if (!accessKeyId || !secretAccessKey) {
      this.logger.warn('S3 credentials not configured');
      return;
    }

    this.s3Client = new S3Client({
      region,
      credentials: { accessKeyId, secretAccessKey },
      ...(endpoint && { endpoint }),
      ...(forcePathStyle && { forcePathStyle: true }),
    });
  }

  @Process({ concurrency: 5 })
  async handleImageAudit(job: Job<ImageAuditJob>) {
    const { uploadId, url, hash, userId, baseUrl } = job.data;

    this.logger.log(`Processing image audit job ${job.id} for upload ${uploadId}`);

    const existingAudit = await this.uploadRepository.findOne({
      where: { hash, auditStatus: 'rejected' },
    });

    if (existingAudit) {
      this.logger.warn(`Image ${uploadId} with hash ${hash} was previously rejected`);
      const upload = await this.uploadRepository.findOne({ where: { id: uploadId } });
      if (upload) {
        await this.handleBlockedImage(upload, baseUrl);
      }
      return { passed: false, reason: 'hash_rejected' };
    }

    const config = this.contentAuditService.getConfig();
    if (!config?.imageEnabled || config?.provider === 'none') {
      await this.uploadRepository.update(uploadId, {
        auditStatus: 'approved',
      });
      return { passed: true, reason: 'audit_disabled' };
    }

    try {
      const result: AuditResult = await this.contentAuditService.auditImageContent(url, userId);

      const upload = await this.uploadRepository.findOne({ where: { id: uploadId } });
      if (!upload) {
        this.logger.warn(`Upload ${uploadId} not found during audit`);
        return { passed: false, reason: 'upload_not_found' };
      }

      if (result.passed) {
        upload.auditStatus = 'approved';
        upload.auditResult = result.details || null;
        await this.uploadRepository.save(upload);
        this.logger.log(`Image ${uploadId} audit passed`);
        return { passed: true, label: result.label };
      }

      upload.auditStatus = 'rejected';
      upload.auditResult = result.details || null;
      await this.uploadRepository.save(upload);
      await this.handleBlockedImage(upload, baseUrl);
      this.logger.warn(`Image ${uploadId} audit rejected: ${result.label}`);
      return { passed: false, label: result.label };
    } catch (error) {
      this.logger.error(`Image audit failed for ${uploadId}:`, error);
      await this.uploadRepository.update(uploadId, {
        auditStatus: 'approved',
      });
      return { passed: true, reason: 'error_fallback' };
    }
  }

  @OnQueueFailed()
  onFailed(job: Job<ImageAuditJob>, err: Error) {
    this.logger.error(
      `Image audit job ${job.id} failed for upload ${job.data.uploadId} after ${job.attemptsMade} attempts:`,
      err.message,
    );
  }

  @OnQueueStalled()
  onStalled(job: Job<ImageAuditJob>) {
    this.logger.warn(
      `Image audit job ${job.id} for upload ${job.data.uploadId} is stalled and will be reprocessed`,
    );
  }

  @OnQueueCompleted()
  onCompleted(job: Job<ImageAuditJob>, result: any) {
    this.logger.log(
      `Image audit job ${job.id} for upload ${job.data.uploadId} completed:`,
      result,
    );
  }

  @OnQueueWaiting()
  onWaiting(jobId: number) {
    this.logger.log(`Image audit job ${jobId} is waiting to be processed`);
  }

  private async handleBlockedImage(upload: Upload, baseUrl?: string) {
    try {
      if (upload.storage === UploadStorageType.LOCAL && upload.path && fs.existsSync(upload.path)) {
        fs.unlinkSync(upload.path);
        if (upload.thumbnails) {
          for (const thumb of upload.thumbnails) {
            if (thumb.path && fs.existsSync(thumb.path)) {
              fs.unlinkSync(thumb.path);
            }
          }
        }
        if (upload.original?.path && fs.existsSync(upload.original.path)) {
          fs.unlinkSync(upload.original.path);
        }
      }

      if (upload.storage === UploadStorageType.S3 && this.s3Client) {
        try {
          await this.s3Client.send(
            new DeleteObjectCommand({
              Bucket: this.configService.get('AWS_BUCKET'),
              Key: upload.path,
            }),
          );
        } catch (err) {
          this.logger.warn(`Failed to delete S3 object ${upload.path}:`, err);
        }
      }

      await this.uploadRepository.save(upload);
      this.logger.log(`Image ${upload.id} blocked, original URL preserved: ${upload.url}`);
    } catch (error) {
      this.logger.error(`Failed to handle blocked image ${upload.id}:`, error);
    }
  }
}

@Processor('text-audit')
export class TextAuditProcessor {
  private readonly logger = new Logger(TextAuditProcessor.name);

  constructor(
    private contentAuditService: ContentAuditService,
    @InjectRepository(Comment)
    private commentRepository: Repository<Comment>,
    @InjectRepository(Article)
    private articleRepository: Repository<Article>,
    @InjectRepository(Upload)
    private uploadRepository: Repository<Upload>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    @InjectRepository(Tag)
    private tagRepository: Repository<Tag>,
    private eventEmitter: EventEmitter2,
  ) {}

  @Process({ concurrency: 10 })
  async handleTextAudit(job: Job<TextAuditJob>) {
    const { type, id, content, userId, images } = job.data;

    this.logger.log(`Processing ${type} audit job ${job.id} for ${type} ${id}`);

    const config = this.contentAuditService.getConfig();
    if (!config?.provider || config.provider === 'none') {
      await this.approveContent(type, id);
      return { passed: true, reason: 'audit_disabled' };
    }

    try {
      const textResult = await this.contentAuditService.auditText({
        content,
        userId,
        type,
      });

      if (!textResult.passed) {
        await this.rejectContent(type, id, textResult);
        this.logger.warn(`${type} ${id} text audit rejected: ${textResult.label}`);
        return { passed: false, label: textResult.label };
      }

      if (images?.length) {
        for (const imageUrl of images) {
          const imageResult = await this.contentAuditService.auditImage({
            url: imageUrl,
            userId,
            type: type === 'article' ? 'article' : 'image',
          });
          if (!imageResult.passed) {
            await this.rejectContent(type, id, imageResult);
            this.logger.warn(`${type} ${id} image audit rejected: ${imageResult.label}`);
            return { passed: false, label: imageResult.label };
          }
        }
      }

      await this.approveContent(type, id);
      this.logger.log(`${type} ${id} audit passed`);
      return { passed: true };
    } catch (error) {
      this.logger.error(`${type} audit failed for ${id}:`, error);
      await this.approveContent(type, id);
      return { passed: true, reason: 'error_fallback' };
    }
  }

  private async approveContent(type: 'comment' | 'article', id: number) {
    if (type === 'comment') {
      await this.commentRepository.manager.transaction(async (manager) => {
        const commentRepository = manager.getRepository(Comment);
        const articleRepository = manager.getRepository(Article);
        const comment = await commentRepository.findOne({
          where: { id },
          relations: ['article', 'article.author', 'author', 'parent', 'parent.author'],
        });

        if (!comment || comment.status === 'PUBLISHED') {
          return;
        }

        await commentRepository.update(id, { status: 'PUBLISHED' });
        await articleRepository.increment({ id: comment.article.id }, 'commentCount', 1);

        if (comment.parent?.id) {
          await commentRepository.increment({ id: comment.parent.id }, 'replyCount', 1);
        }

        this.eventEmitter.emit('comment.created', {
          userId: comment.author?.id,
          userName: comment.author?.nickname || comment.author?.username,
          articleId: comment.article.id,
          articleTitle: comment.article.title,
          commentId: comment.id,
          commentContent: comment.content,
          authorId: comment.article.author?.id,
          parentCommentId: comment.parent?.id || null,
          parentAuthorId: comment.parent?.author?.id,
        });

        this.eventEmitter.emit('article.receivedComment', {
          authorId: comment.article.author?.id,
          articleId: comment.article.id,
          commenterId: comment.author?.id,
          commentId: comment.id,
        });
      });
      return;
    }

    const article = await this.articleRepository.findOne({
      where: { id },
      relations: ['category', 'tags'],
    });

    if (!article || article.status !== 'PENDING') {
      return;
    }

    await this.articleRepository.update(id, { status: 'PUBLISHED' });
    await this.userRepository.increment({ id: article.authorId }, 'articleCount', 1);

    if (article.category?.id) {
      await this.categoryRepository.increment({ id: article.category.id }, 'articleCount', 1);
    }

    if (article.tags?.length) {
      for (const tag of article.tags) {
        await this.tagRepository.increment({ id: tag.id }, 'articleCount', 1);
      }
    }

    this.eventEmitter.emit('article.created', {
      userId: article.authorId,
      articleId: id,
    });
    this.eventEmitter.emit('article.auditApproved', {
      articleId: id,
      authorId: article.authorId,
      title: article.title,
    });
  }

  private async rejectContent(
    type: 'comment' | 'article',
    id: number,
    result: AuditResult,
  ) {
    if (type === 'comment') {
      const comment = await this.commentRepository.findOne({
        where: { id },
        relations: ['article', 'parent'],
      });

      if (!comment) {
        return;
      }

      if (comment.status === 'PUBLISHED') {
        if (comment.parent) {
          comment.parent.replyCount = Math.max(0, comment.parent.replyCount - 1);
          await this.commentRepository.save(comment.parent);
        }

        if (comment.article) {
          await this.articleRepository.decrement(
            { id: comment.article.id },
            'commentCount',
            1,
          );
        }
      }

      await this.commentRepository.update(id, { status: 'REJECTED' });
      this.logger.log(`Comment ${id} rejected due to audit rejection`);
      return;
    }

    const article = await this.articleRepository.findOne({ where: { id } });
    if (!article) {
      return;
    }

    await this.articleRepository.update(id, {
      status: 'REJECTED',
    });
    this.eventEmitter.emit('article.auditRejected', {
      articleId: id,
      authorId: article.authorId,
      title: article.title,
      reason: result.reason || result.label || '内容违规',
    });
  }

  @OnQueueFailed()
  onFailed(job: Job<TextAuditJob>, err: Error) {
    this.logger.error(
      `Text audit job ${job.id} for ${job.data.type} ${job.data.id} failed after ${job.attemptsMade} attempts:`,
      err.message,
    );
  }

  @OnQueueStalled()
  onStalled(job: Job<TextAuditJob>) {
    this.logger.warn(
      `Text audit job ${job.id} for ${job.data.type} ${job.data.id} is stalled and will be reprocessed`,
    );
  }

  @OnQueueCompleted()
  onCompleted(job: Job<TextAuditJob>, result: any) {
    this.logger.log(
      `Text audit job ${job.id} for ${job.data.type} ${job.data.id} completed:`,
      result,
    );
  }

  @OnQueueWaiting()
  onWaiting(jobId: number) {
    this.logger.log(`Text audit job ${jobId} is waiting to be processed`);
  }
}
