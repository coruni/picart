import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '../config/config.service';
import {
  AuditResult,
  TextAuditRequest,
  ImageAuditRequest,
  AuditProvider,
} from './dto/audit.dto';
import { TencentAuditService } from './providers/tencent-audit.service';
import { AliyunAuditService } from './providers/aliyun-audit.service';
import { Upload } from '../upload/entities/upload.entity';

type AuditScene = 'comment' | 'avatar' | 'image' | 'article';

@Injectable()
export class ContentAuditService implements OnModuleInit {
  private readonly logger = new Logger(ContentAuditService.name);
  private auditConfig: {
    provider: AuditProvider;
    commentEnabled: boolean;
    avatarEnabled: boolean;
    imageEnabled: boolean;
    articleEnabled: boolean;
    autoBlock: boolean;
    sensitivity: string;
    reviewMode: 'auto' | 'manual';
    tencent: {
      secretId: string;
      secretKey: string;
      region: string;
      textBizType: string;
      imageBizType: string;
    };
    aliyun: {
      accessKeyId: string;
      accessKeySecret: string;
      region: string;
    };
  };

  constructor(
    private configService: ConfigService,
    private tencentService: TencentAuditService,
    private aliyunService: AliyunAuditService,
    @InjectRepository(Upload)
    private uploadRepository: Repository<Upload>,
  ) {}

  private parseBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    if (typeof value === 'number') {
      return value !== 0;
    }
    return false;
  }

  private passResult(scene?: string): AuditResult {
    return {
      passed: true,
      action: 'pass',
      scene,
      suggestion: 'pass',
    };
  }

  private normalizeAuditResult(
    result: AuditResult,
    scene: string,
    fallbackReason?: string,
  ): AuditResult {
    const passed = result.passed !== false;
    const suggestion = result.suggestion?.toLowerCase();
    const action =
      result.action ||
      (passed ? (suggestion === 'review' ? 'review' : 'pass') : 'block');

    return {
      ...result,
      passed,
      action,
      scene,
      suggestion: suggestion || (passed ? action : 'block'),
      reason: result.reason || result.label || fallbackReason,
    };
  }

  private isSceneEnabled(scene: AuditScene): boolean {
    switch (scene) {
      case 'comment':
        return !!this.auditConfig?.commentEnabled;
      case 'avatar':
        return !!this.auditConfig?.avatarEnabled;
      case 'image':
        return !!this.auditConfig?.imageEnabled;
      case 'article':
        return !!this.auditConfig?.articleEnabled;
      default:
        return false;
    }
  }

  async onModuleInit() {
    await this.loadAuditConfig();
  }

  async loadAuditConfig() {
    try {
      const [
        provider,
        commentEnabled,
        avatarEnabled,
        imageEnabled,
        articleEnabled,
        autoBlock,
        sensitivity,
        reviewMode,
        tencentSecretId,
        tencentSecretKey,
        tencentRegion,
        tencentTextBizType,
        tencentImageBizType,
        aliyunAccessKeyId,
        aliyunAccessKeySecret,
        aliyunRegion,
      ] = await Promise.all([
        this.configService.getCachedConfig('content_audit_provider', 'none'),
        this.configService.getCachedConfig('content_audit_comment_enabled', false),
        this.configService.getCachedConfig('content_audit_avatar_enabled', false),
        this.configService.getCachedConfig('content_audit_image_enabled', false),
        this.configService.getCachedConfig('content_audit_article_enabled', false),
        this.configService.getCachedConfig('content_audit_auto_block', true),
        this.configService.getCachedConfig('content_audit_sensitivity', 'medium'),
        this.configService.getCachedConfig('content_audit_review_mode', 'auto'),
        this.configService.getCachedConfig('tencent_secret_id', ''),
        this.configService.getCachedConfig('tencent_secret_key', ''),
        this.configService.getCachedConfig('tencent_region', 'ap-beijing'),
        this.configService.getCachedConfig('tencent_text_biz_type', ''),
        this.configService.getCachedConfig('tencent_image_biz_type', ''),
        this.configService.getCachedConfig('aliyun_access_key_id', ''),
        this.configService.getCachedConfig('aliyun_access_key_secret', ''),
        this.configService.getCachedConfig('aliyun_region', 'cn-beijing'),
      ]);

      this.auditConfig = {
        provider: (provider as AuditProvider) || AuditProvider.NONE,
        commentEnabled: this.parseBoolean(commentEnabled),
        avatarEnabled: this.parseBoolean(avatarEnabled),
        imageEnabled: this.parseBoolean(imageEnabled),
        articleEnabled: this.parseBoolean(articleEnabled),
        autoBlock: this.parseBoolean(autoBlock),
        sensitivity: (sensitivity as string) || 'medium',
        reviewMode: (reviewMode as 'auto' | 'manual') || 'auto',
        tencent: {
          secretId: (tencentSecretId as string) || '',
          secretKey: (tencentSecretKey as string) || '',
          region: (tencentRegion as string) || 'ap-beijing',
          textBizType: (tencentTextBizType as string) || '',
          imageBizType: (tencentImageBizType as string) || '',
        },
        aliyun: {
          accessKeyId: (aliyunAccessKeyId as string) || '',
          accessKeySecret: (aliyunAccessKeySecret as string) || '',
          region: (aliyunRegion as string) || 'cn-beijing',
        },
      };

      if (this.auditConfig.provider === AuditProvider.TENCENT) {
        this.tencentService.setConfig(this.auditConfig.tencent);
      } else if (this.auditConfig.provider === AuditProvider.ALIYUN) {
        this.aliyunService.setConfig(this.auditConfig.aliyun);
      }

      this.logger.log(
        `Content audit service initialized with provider: ${this.auditConfig.provider}`,
      );
    } catch (error) {
      this.logger.error('Failed to load config:', error);
    }
  }

  async auditArticle(
    content: string,
    images: string[],
    userId?: number,
  ): Promise<AuditResult> {
    const textResult = await this.auditText({ content, userId, type: 'article' });
    if (!textResult.passed) {
      this.logger.warn(`Article text blocked by audit: userId=${userId}`);
      return textResult;
    }

    if (images?.length) {
      for (const imageUrl of images) {
        const imageResult = await this.auditImage({
          url: imageUrl,
          userId,
          type: 'article',
        });
        if (!imageResult.passed) {
          this.logger.warn(
            `Article image blocked by audit: userId=${userId}, url=${imageUrl}`,
          );
          return imageResult;
        }
      }
    }

    return this.passResult('article');
  }

  async auditComment(content: string, userId?: number): Promise<AuditResult> {
    const result = await this.auditText({ content, userId, type: 'comment' });

    if (!result.passed && this.auditConfig.autoBlock) {
      this.logger.warn(
        `Comment blocked by audit: userId=${userId}, label=${result.label}`,
      );
    }

    return result;
  }

  async auditAvatar(imageUrl: string, userId?: number): Promise<AuditResult> {
    const localPath = await this.resolveLocalPath(imageUrl);
    const result = await this.auditImage({ url: imageUrl, localPath, userId, type: 'avatar' });

    if (!result.passed && this.auditConfig.autoBlock) {
      this.logger.warn(
        `Avatar blocked by audit: userId=${userId}, label=${result.label}`,
      );
    }

    return result;
  }

  async auditImageContent(
    imageUrl: string,
    userId?: number,
  ): Promise<AuditResult> {
    const localPath = await this.resolveLocalPath(imageUrl);
    const result = await this.auditImage({ url: imageUrl, localPath, userId, type: 'image' });

    if (!result.passed && this.auditConfig.autoBlock) {
      this.logger.warn(
        `Image blocked by audit: userId=${userId}, label=${result.label}`,
      );
    }

    return result;
  }

  private async resolveLocalPath(imageUrl: string): Promise<string | undefined> {
    try {
      const upload = await this.uploadRepository.findOne({ where: { url: imageUrl }, cache: false });
      return upload?.path;
    } catch {
      return undefined;
    }
  }

  async auditText(request: TextAuditRequest): Promise<AuditResult> {
    const scene = request.type || request.scene || 'text';
    if (
      this.auditConfig?.provider === AuditProvider.NONE ||
      (request.type && !this.isSceneEnabled(request.type as AuditScene))
    ) {
      return this.passResult(scene);
    }

    if (this.auditConfig.provider === AuditProvider.TENCENT) {
      return this.normalizeAuditResult(
        await this.tencentService.auditText(request),
        scene,
      );
    }

    if (this.auditConfig.provider === AuditProvider.ALIYUN) {
      return this.normalizeAuditResult(
        await this.aliyunService.auditText(request),
        scene,
      );
    }

    return this.passResult(scene);
  }

  async auditImage(request: ImageAuditRequest): Promise<AuditResult> {
    const scene = request.type || request.scene || 'image';
    const sceneToCheck =
      request.type === 'avatar'
        ? 'avatar'
        : request.type === 'article'
          ? 'article'
          : 'image';

    if (
      this.auditConfig?.provider === AuditProvider.NONE ||
      !this.isSceneEnabled(sceneToCheck)
    ) {
      return this.passResult(scene);
    }

    if (this.auditConfig.provider === AuditProvider.TENCENT) {
      return this.normalizeAuditResult(
        await this.tencentService.auditImage(request),
        scene,
      );
    }

    if (this.auditConfig.provider === AuditProvider.ALIYUN) {
      return this.normalizeAuditResult(
        await this.aliyunService.auditImage(request),
        scene,
      );
    }

    return this.passResult(scene);
  }

  async isCommentAuditEnabled(): Promise<boolean> {
    if (!this.auditConfig) {
      await this.loadAuditConfig();
    }
    return this.isSceneEnabled('comment') && this.auditConfig.provider !== AuditProvider.NONE;
  }

  async isArticleAuditEnabled(): Promise<boolean> {
    if (!this.auditConfig) {
      await this.loadAuditConfig();
    }
    return this.isSceneEnabled('article') && this.auditConfig.provider !== AuditProvider.NONE;
  }

  async isImageAuditEnabled(): Promise<boolean> {
    if (!this.auditConfig) {
      await this.loadAuditConfig();
    }
    return this.isSceneEnabled('image') && this.auditConfig.provider !== AuditProvider.NONE;
  }

  async isAvatarAuditEnabled(): Promise<boolean> {
    if (!this.auditConfig) {
      await this.loadAuditConfig();
    }
    return this.isSceneEnabled('avatar') && this.auditConfig.provider !== AuditProvider.NONE;
  }

  needManualReview(): boolean {
    return this.auditConfig?.reviewMode === 'manual';
  }

  getConfig() {
    return this.auditConfig;
  }

  async reloadConfig() {
    await this.loadAuditConfig();
  }

  @OnEvent('config.updated')
  async handleConfigUpdate() {
    await this.loadAuditConfig();
    this.logger.log('Audit config reloaded due to config update');
  }
}
