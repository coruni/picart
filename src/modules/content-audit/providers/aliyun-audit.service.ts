import { Injectable, Logger } from '@nestjs/common';
import * as Green from '@alicloud/green20220302';
import * as OpenApi from '@alicloud/openapi-client';
import { AuditResult, TextAuditRequest, ImageAuditRequest } from '../dto/audit.dto';

@Injectable()
export class AliyunAuditService {
  private readonly logger = new Logger(AliyunAuditService.name);
  private client: Green.default;
  private config: {
    accessKeyId: string;
    accessKeySecret: string;
    region: string;
  };

  setConfig(config: {
    accessKeyId: string;
    accessKeySecret: string;
    region: string;
  }) {
    this.config = config;
    const clientConfig = new OpenApi.Config({
      accessKeyId: config.accessKeyId,
      accessKeySecret: config.accessKeySecret,
      endpoint: `green-cip.${config.region}.aliyuncs.com`,
    });
    this.client = new Green.default(clientConfig);
  }

  isConfigured(): boolean {
    return !!(this.config?.accessKeyId && this.config?.accessKeySecret);
  }

  async auditText(request: TextAuditRequest): Promise<AuditResult> {
    if (!this.isConfigured()) {
      return { passed: true };
    }

    try {
      // 根据内容类型自动选择阿里云 service
      // 如果传入了 scene 则使用传入的，否则根据 type 自动判断
      let service: string;
      if (request.scene) {
        service = request.scene;
      } else {
        switch (request.type) {
          case 'nickname':
            service = 'nickname_detection';
            break;
          case 'chat':
            service = 'chat_detection';
            break;
          case 'article':
            service = 'pgc_detection';
            break;
          case 'comment':
          default:
            service = 'comment_detection';
            break;
        }
      }

      const textRequest = new Green.TextModerationRequest({
        service,
        serviceParameters: JSON.stringify({
          content: request.content,
        }),
      });

      const response = await this.client.textModeration(textRequest);

      // 阿里云返回结果: pass=通过, review=人工审核, block=拦截
      const result = response.body?.data?.result;
      const suggestion = result?.[0]?.label;

      return {
        passed: suggestion !== 'block',
        label: suggestion,
        confidence: result?.[0]?.confidence,
        suggestion,
        details: response.body,
      };
    } catch (error) {
      this.logger.error('Aliyun text audit failed:', error);
      return { passed: true };
    }
  }

  async auditImage(request: ImageAuditRequest): Promise<AuditResult> {
    if (!this.isConfigured()) {
      return { passed: true };
    }

    try {
      // 根据图片类型自动选择阿里云 service
      // baselineCheck: 通用基线审核, profilePhotoCheck: 头像审核
      let service: string;
      if (request.scene) {
        service = request.scene;
      } else {
        switch (request.type) {
          case 'avatar':
            service = 'profilePhotoCheck';
            break;
          case 'image':
          case 'article':
          default:
            service = 'baselineCheck';
            break;
        }
      }

      const imageRequest = new Green.ImageModerationRequest({
        service,
        serviceParameters: JSON.stringify({
          imageUrl: request.url,
        }),
      });

      const response = await this.client.imageModeration(imageRequest);

      // 阿里云图片审核结果处理
      const data = response.body?.data;
      let passed = true;
      let label = '';
      let confidence = 0;

      // 检查 riskLevel: none=正常, low=低风险, high=高风险
      if (data?.riskLevel === 'high') {
        passed = false;
        label = data?.result?.[0]?.label || 'block';
        confidence = data?.score || 0;
      }

      return {
        passed,
        label,
        confidence,
        suggestion: passed ? 'pass' : 'block',
        details: response.body,
      };
    } catch (error) {
      this.logger.error('Aliyun image audit failed:', error);
      return { passed: true };
    }
  }
}
