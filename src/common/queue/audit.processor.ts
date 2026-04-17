import { Processor, Process, InjectQueue, OnQueueFailed } from '@nestjs/bull';
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
  private readonly BLOCKED_IMAGE_PATH = '/images/blocked.png';

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

  @Process({ concurrency: 5 }) // 限制同时处理5个图片审核
  async handleImageAudit(job: Job<ImageAuditJob>) {
    const { uploadId, url, hash, userId, baseUrl } = job.data;

    this.logger.log(`Processing image audit job ${job.id} for upload ${uploadId}`);

    // 检查是否已有相同 hash 的审核结果
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

    // 检查审核配置
    const config = this.contentAuditService.getConfig();
    if (!config?.imageEnabled || config?.provider === 'none') {
      await this.uploadRepository.update(uploadId, {
        auditStatus: 'approved',
      });
      return { passed: true, reason: 'audit_disabled' };
    }

    try {
      // 执行审核
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
      } else {
        upload.auditStatus = 'rejected';
        upload.auditResult = result.details || null;
        await this.uploadRepository.save(upload);
        await this.handleBlockedImage(upload, baseUrl);
        this.logger.warn(`Image ${uploadId} audit rejected: ${result.label}`);
        return { passed: false, label: result.label };
      }
    } catch (error) {
      this.logger.error(`Image audit failed for ${uploadId}:`, error);
      // 审核异常时标记为通过（降级处理）
      await this.uploadRepository.update(uploadId, {
        auditStatus: 'approved',
      });
      return { passed: true, reason: 'error_fallback' };
    }
  }

  @OnQueueFailed()
  onFailed(job: Job<ImageAuditJob>, err: Error) {
    this.logger.error(
      `Image audit job ${job.id} failed for upload ${job.data.uploadId}:`,
      err.message,
    );
  }

  private async handleBlockedImage(upload: Upload, baseUrl?: string) {
    try {
      // 删除本地文件
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

      // 删除 S3 文件
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

      // 替换 URL 为占位图
      upload.url = `${baseUrl || ''}${this.BLOCKED_IMAGE_PATH}`;
      upload.thumbnails = null;
      upload.original = null;
      await this.uploadRepository.save(upload);
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
    private eventEmitter: EventEmitter2,
  ) {}

  @Process({ concurrency: 10 }) // 文本审核并发更高
  async handleTextAudit(job: Job<TextAuditJob>) {
    const { type, id, content, userId, images } = job.data;

    this.logger.log(`Processing ${type} audit job ${job.id} for ${type} ${id}`);

    const config = this.contentAuditService.getConfig();
    if (!config?.provider || config.provider === 'none') {
      await this.approveContent(type, id);
      return { passed: true, reason: 'audit_disabled' };
    }

    try {
      // 先审核文字内容
      const textResult = await this.contentAuditService.auditText({ content, userId });

      if (!textResult.passed) {
        // 文字审核不通过
        await this.rejectContent(type, id, textResult);
        this.logger.warn(`${type} ${id} text audit rejected: ${textResult.label}`);
        return { passed: false, label: textResult.label };
      }

      // 如果有图片，审核图片
      if (images && images.length > 0) {
        for (const imageUrl of images) {
          const imageResult = await this.contentAuditService.auditImageContent(imageUrl, userId);
          if (!imageResult.passed) {
            await this.rejectContent(type, id, imageResult);
            this.logger.warn(`${type} ${id} image audit rejected: ${imageResult.label}`);
            return { passed: false, label: imageResult.label };
          }
        }
      }

      // 全部通过
      await this.approveContent(type, id);
      this.logger.log(`${type} ${id} audit passed`);
      return { passed: true };

    } catch (error) {
      this.logger.error(`${type} audit failed for ${id}:`, error);
      // 审核异常时通过（降级处理）
      await this.approveContent(type, id);
      return { passed: true, reason: 'error_fallback' };
    }
  }

  private async approveContent(type: 'comment' | 'article', id: number) {
    if (type === 'comment') {
      await this.commentRepository.update(id, { status: 'PUBLISHED' });
    } else {
      const article = await this.articleRepository.findOne({ where: { id } });
      if (article && article.status === 'PENDING') {
        await this.articleRepository.update(id, { status: 'PUBLISHED' });
        // 发送文章审核通过通知
        this.eventEmitter.emit('article.auditApproved', {
          articleId: id,
          authorId: article.authorId,
          title: article.title,
        });
      }
    }
  }

  private async rejectContent(type: 'comment' | 'article', id: number, result: AuditResult) {
    if (type === 'comment') {
      // 审核不通过直接删除评论
      const comment = await this.commentRepository.findOne({
        where: { id },
        relations: ['article', 'parent'],
      });
      if (comment) {
        // 如果有父评论，减少回复计数
        if (comment.parent) {
          comment.parent.replyCount = Math.max(0, comment.parent.replyCount - 1);
          await this.commentRepository.save(comment.parent);
        }
        // 减少文章评论计数
        if (comment.article) {
          await this.articleRepository.increment(
            { id: comment.article.id },
            'commentCount',
            -1,
          );
        }
        // 删除评论
        await this.commentRepository.remove(comment);
        this.logger.log(`Comment ${id} deleted due to audit rejection`);
      }
    } else {
      const article = await this.articleRepository.findOne({ where: { id } });
      if (article) {
        await this.articleRepository.update(id, {
          status: 'REJECTED',
        });
        // 发送文章审核不通过通知
        this.eventEmitter.emit('article.auditRejected', {
          articleId: id,
          authorId: article.authorId,
          title: article.title,
          reason: result.label || '内容违规',
        });
      }
    }
  }

  @OnQueueFailed()
  onFailed(job: Job<TextAuditJob>, err: Error) {
    this.logger.error(`Text audit job ${job.id} failed:`, err.message);
  }
}
