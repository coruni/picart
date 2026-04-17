import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '../config/config.service';
import { AuditResult, TextAuditRequest, ImageAuditRequest, AuditProvider } from './dto/audit.dto';
import { TencentAuditService } from './providers/tencent-audit.service';
import { AliyunAuditService } from './providers/aliyun-audit.service';

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
  ) {}

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
        this.configService.getCachedConfig('content_audit_comment_enabled', 'false'),
        this.configService.getCachedConfig('content_audit_avatar_enabled', 'false'),
        this.configService.getCachedConfig('content_audit_image_enabled', 'false'),
        this.configService.getCachedConfig('content_audit_article_enabled', 'false'),
        this.configService.getCachedConfig('content_audit_auto_block', 'true'),
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
        commentEnabled: commentEnabled === 'true',
        avatarEnabled: avatarEnabled === 'true',
        imageEnabled: imageEnabled === 'true',
        articleEnabled: articleEnabled === 'true',
        autoBlock: autoBlock === 'true',
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

      // 初始化对应的服务商客户端
      if (this.auditConfig.provider === AuditProvider.TENCENT) {
        this.tencentService.setConfig(this.auditConfig.tencent);
      } else if (this.auditConfig.provider === AuditProvider.ALIYUN) {
        this.aliyunService.setConfig(this.auditConfig.aliyun);
      }

      this.logger.log(`Content audit service initialized with provider: ${this.auditConfig.provider}`);
    } catch (error) {
      this.logger.error('Failed to load config:', error);
    }
  }


  /**
   * 审核文章
   */
  async auditArticle(
    content: string,
    images: string[],
    userId?: number,
  ): Promise<AuditResult> {
    if (!this.auditConfig?.articleEnabled || this.auditConfig?.provider === AuditProvider.NONE) {
      return { passed: true };
    }

    // 审核文字内容
    const textResult = await this.auditText({ content, userId, type: 'article' });
    if (!textResult.passed) {
      this.logger.warn(`Article text blocked by audit: userId=${userId}`);
      return textResult;
    }

    // 审核图片
    if (images && images.length > 0) {
      for (const imageUrl of images) {
        const imageResult = await this.auditImage({ url: imageUrl, userId, type: 'article' });
        if (!imageResult.passed) {
          this.logger.warn(`Article image blocked by audit: userId=${userId}, url=${imageUrl}`);
          return imageResult;
        }
      }
    }

    return { passed: true };
  }

  /**
   * 审核文本内容（评论）
   */
  async auditComment(content: string, userId?: number): Promise<AuditResult> {
    if (!this.auditConfig?.commentEnabled || this.auditConfig?.provider === AuditProvider.NONE) {
      return { passed: true };
    }

    const result = await this.auditText({ content, userId, type: 'comment' });

    if (!result.passed && this.auditConfig.autoBlock) {
      this.logger.warn(`Comment blocked by audit: userId=${userId}, label=${result.label}`);
    }

    return result;
  }

  /**
   * 审核头像
   */
  async auditAvatar(imageUrl: string, userId?: number): Promise<AuditResult> {
    if (!this.auditConfig?.avatarEnabled || this.auditConfig?.provider === AuditProvider.NONE) {
      return { passed: true };
    }

    const result = await this.auditImage({ url: imageUrl, userId, type: 'avatar' });

    if (!result.passed && this.auditConfig.autoBlock) {
      this.logger.warn(`Avatar blocked by audit: userId=${userId}, label=${result.label}`);
    }

    return result;
  }

  /**
   * 审核图片
   */
  async auditImageContent(imageUrl: string, userId?: number): Promise<AuditResult> {
    if (!this.auditConfig?.imageEnabled || this.auditConfig?.provider === AuditProvider.NONE) {
      return { passed: true };
    }

    const result = await this.auditImage({ url: imageUrl, userId, type: 'image' });

    if (!result.passed && this.auditConfig.autoBlock) {
      this.logger.warn(`Image blocked by audit: userId=${userId}, label=${result.label}`);
    }

    return result;
  }

  /**
   * 通用文本审核
   */
  async auditText(request: TextAuditRequest): Promise<AuditResult> {
    if (this.auditConfig?.provider === AuditProvider.NONE) {
      return { passed: true };
    }

    if (this.auditConfig?.provider === AuditProvider.TENCENT) {
      return this.tencentService.auditText(request);
    } else if (this.auditConfig?.provider === AuditProvider.ALIYUN) {
      return this.aliyunService.auditText(request);
    }

    return { passed: true };
  }

  /**
   * 通用图片审核
   */
  async auditImage(request: ImageAuditRequest): Promise<AuditResult> {
    if (this.auditConfig?.provider === AuditProvider.NONE) {
      return { passed: true };
    }

    if (this.auditConfig?.provider === AuditProvider.TENCENT) {
      return this.tencentService.auditImage(request);
    } else if (this.auditConfig?.provider === AuditProvider.ALIYUN) {
      return this.aliyunService.auditImage(request);
    }

    return { passed: true };
  }

  /**
   * 是否需要人工审核
   */
  needManualReview(): boolean {
    return this.auditConfig?.reviewMode === 'manual';
  }

  /**
   * 获取当前审核配置
   */
  getConfig() {
    return this.auditConfig;
  }

  /**
   * 重新加载配置
   */
  async reloadConfig() {
    await this.loadAuditConfig();
  }

  /**
   * 监听配置更新事件
   */
  @OnEvent('config.updated')
  async handleConfigUpdate() {
    await this.loadAuditConfig();
    this.logger.log('Audit config reloaded due to config update');
  }
}
