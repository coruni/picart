import { Injectable, Logger } from '@nestjs/common';
import * as tencentcloud from 'tencentcloud-sdk-nodejs';
import { AuditResult, TextAuditRequest, ImageAuditRequest } from '../dto/audit.dto';
import * as fs from 'fs';

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
        signMethod: 'TC3-HMAC-SHA256' as const,
        httpProfile: {
          reqMethod: 'POST' as const,
          reqTimeout: 30,
        },
      },
    };
    this.tmsClient = new TmsClient(clientConfig);
    this.imsClient = new ImsClient(clientConfig);
  }

  private resolveAction(suggestion?: string): 'pass' | 'review' | 'block' {
    const normalized = suggestion?.toLowerCase();
    if (normalized === 'review') {
      return 'review';
    }
    if (normalized === 'block') {
      return 'block';
    }
    return 'pass';
  }

  isConfigured(): boolean {
    return !!(this.config?.secretId && this.config?.secretKey);
  }

  async auditText(request: TextAuditRequest): Promise<AuditResult> {
    if (!this.isConfigured()) {
      return { passed: true, action: 'pass', suggestion: 'pass' };
    }

    try {
      const params: any = {
        Content: Buffer.from(request.content).toString('base64'),
      };

      if (request.userId) {
        params.DataId = `text:${request.type || 'default'}:${request.userId}`;
      }

      if (this.config.textBizType) {
        params.BizType = this.config.textBizType;
      }

      const response = await this.tmsClient.TextModeration(params);
      const data = response || {};
      const suggestion = data.Suggestion || 'Pass';
      const label = data.Label || data.EvilLabel;
      const action = this.resolveAction(suggestion);

      return {
        passed: action !== 'block',
        action,
        label,
        confidence: data.Score,
        suggestion: suggestion.toLowerCase(),
        details: response,
      };
    } catch (error) {
      this.logger.error('Tencent text audit failed:', error);
      return { passed: true, action: 'pass', suggestion: 'pass' };
    }
  }

  async auditImage(request: ImageAuditRequest): Promise<AuditResult> {
    if (!this.isConfigured()) {
      return { passed: true, action: 'pass', suggestion: 'pass' };
    }

    try {
      const params: any = {
        Type: 'IMAGE',
      };

      // 优先使用本地文件 Base64 上传（解决本地开发时外网无法访问问题）
      if (request.localPath && fs.existsSync(request.localPath)) {
        params.FileContent = fs.readFileSync(request.localPath).toString('base64');
      } else {
        params.FileUrl = request.url;
      }

      if (request.userId) {
        params.DataId = `image:${request.type || 'default'}:${request.userId}`;
      }

      if (this.config.imageBizType) {
        params.BizType = this.config.imageBizType;
      }

      const response = await this.imsClient.ImageModeration(params);
      const data = response || {};

      // 优先使用根级别的字段，回退到数组中的第一个结果
      const objectResult = data.ObjectResults?.[0];
      const ocrResult = data.OcrResults?.[0];
      const libResult = data.LibResults?.[0];

      // 从 LabelResults 中找出有问题的分类
      const hitLabelResult = data.LabelResults?.find(
        (r: any) => r.HitFlag === 1 || r.Suggestion === 'Block',
      );

      // Suggestion: 根级别优先，其次从命中结果取，最后从子结果取
      const suggestion =
        data.Suggestion ||
        hitLabelResult?.Suggestion ||
        objectResult?.Suggestion ||
        ocrResult?.Suggestion ||
        libResult?.Suggestion ||
        'Pass';

      // Label: 根级别优先，其次从命中结果取
      const label =
        data.Label ||
        hitLabelResult?.Label ||
        objectResult?.Label ||
        ocrResult?.Label ||
        libResult?.Label ||
        'Normal';

      // Score: 根级别优先（根级别的 Score 是最高分），其次从子结果取
      const confidence =
        data.Score ??
        hitLabelResult?.Score ??
        objectResult?.Score ??
        ocrResult?.Score ??
        libResult?.Score ??
        0;

      const action = this.resolveAction(suggestion);

      return {
        passed: action !== 'block',
        action,
        label,
        confidence,
        suggestion: suggestion.toLowerCase(),
        details: response,
      };
    } catch (error) {
      this.logger.error('Tencent image audit failed:', error);
      return { passed: true, action: 'pass', suggestion: 'pass' };
    }
  }
}
