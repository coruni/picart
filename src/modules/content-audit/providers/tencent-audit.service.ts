import { Injectable, Logger } from '@nestjs/common';
import * as tencentcloud from 'tencentcloud-sdk-nodejs';
import { AuditResult, TextAuditRequest, ImageAuditRequest } from '../dto/audit.dto';

const TmsClient = tencentcloud.tms.v20201229.Client;
const ImsClient = tencentcloud.ims.v20201229.Client;

@Injectable()
export class TencentAuditService {
  private readonly logger = new Logger(TencentAuditService.name);
  private tmsClient: any;
  private imsClient: any;
  private config: {
    secretId: string;
    secretKey: string;
    region: string;
    textBizType?: string;
    imageBizType?: string;
  };

  setConfig(config: {
    secretId: string;
    secretKey: string;
    region: string;
    textBizType?: string;
    imageBizType?: string;
  }) {
    this.config = config;
    const clientConfig = {
      credential: {
        secretId: config.secretId,
        secretKey: config.secretKey,
      },
      region: config.region,
      profile: {
        signMethod: 'TC3-HMAC-SHA256' as 'TC3-HMAC-SHA256',
        httpProfile: {
          reqMethod: 'POST' as 'POST',
          reqTimeout: 30,
        },
      },
    };
    this.tmsClient = new TmsClient(clientConfig);
    this.imsClient = new ImsClient(clientConfig);
  }

  isConfigured(): boolean {
    return !!(this.config?.secretId && this.config?.secretKey);
  }

  async auditText(request: TextAuditRequest): Promise<AuditResult> {
    if (!this.isConfigured()) {
      return { passed: true };
    }

    try {
      const params: any = {
        Content: request.content,
      };

      if (this.config.textBizType) {
        params.BizType = this.config.textBizType;
      }

      const response = await this.tmsClient.TextModeration(params);

      // 腾讯云返回结果: 0=正常, 1=不确定, 2=可疑
      const suggestion = response.Suggestion;
      const label = response.Label;

      return {
        passed: suggestion === 'Pass' || suggestion === 'Review',
        label,
        confidence: response.Confidence,
        suggestion,
        details: response,
      };
    } catch (error) {
      this.logger.error('Tencent text audit failed:', error);
      // 审核失败时默认通过（降级处理）
      return { passed: true };
    }
  }

  async auditImage(request: ImageAuditRequest): Promise<AuditResult> {
    if (!this.isConfigured()) {
      return { passed: true };
    }

    try {
      const params: any = {
        FileUrl: request.url,
      };

      if (this.config.imageBizType) {
        params.BizType = this.config.imageBizType;
      }

      const response = await this.imsClient.ImageModeration(params);

      const suggestion = response.Suggestion;
      const label = response.Label;

      return {
        passed: suggestion === 'Pass' || suggestion === 'Review',
        label,
        confidence: response.Confidence,
        suggestion,
        details: response,
      };
    } catch (error) {
      this.logger.error('Tencent image audit failed:', error);
      return { passed: true };
    }
  }
}
