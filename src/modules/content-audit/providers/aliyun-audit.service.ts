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
    textScene?: string;
    imageScene?: string;
  };

  setConfig(config: {
    accessKeyId: string;
    accessKeySecret: string;
    region: string;
    textScene?: string;
    imageScene?: string;
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
      const scene = request.scene || this.config.textScene || 'antispam';
      const textRequest = new Green.TextModerationRequest({
        service: scene,
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
      const scenes = request.scene || this.config.imageScene || 'porn,sensitive,terrorism';
      const sceneList = scenes.split(',').map(s => s.trim());

      const imageRequest = new Green.ImageModerationRequest({
        service: 'imageDetection',
        serviceParameters: JSON.stringify({
          imageUrl: request.url,
          scene: sceneList,
        }),
      });

      const response = await this.client.imageModeration(imageRequest);

      const results = response.body?.data?.result;
      let passed = true;
      let highestRiskLabel = '';
      let confidence = 0;

      // 检查所有场景的结果
      for (const result of results || []) {
        if (result.label === 'block') {
          passed = false;
          highestRiskLabel = result.scene;
          confidence = Math.max(confidence, result.confidence || 0);
        }
      }

      return {
        passed,
        label: highestRiskLabel,
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
