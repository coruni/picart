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

      // 阿里云文本审核返回结果解析
      // data.labels: 风险标签，逗号分隔
      // data.reason: JSON字符串，包含 riskLevel (high/medium/low)
      const data = response.body?.data;
      const labels = data?.labels || '';
      let riskLevel = '';
      let passed = true;

      // 解析 reason 字段获取 riskLevel
      if (data?.reason) {
        try {
          const reasonObj = JSON.parse(data.reason);
          riskLevel = reasonObj.riskLevel || '';
        } catch {
          // reason 不是 JSON，忽略
        }
      }

      // riskLevel 为 high 时拦截
      if (riskLevel === 'high') {
        passed = false;
      }

      // 如果有风险标签，也认为需要关注
      const hasLabels = labels.length > 0 && labels !== 'nonLabel';

      return {
        passed,
        label: hasLabels ? labels : undefined,
        suggestion: riskLevel === 'high' ? 'block' : hasLabels ? 'review' : 'pass',
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
