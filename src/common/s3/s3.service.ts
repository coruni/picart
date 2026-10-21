import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { S3Client } from "@aws-sdk/client-s3";
import {
  buildS3PublicUrl,
  createS3Client,
  hasS3Credentials,
  resolveS3ConnectionOptions,
  S3ConnectionOptions,
} from "./s3-client.factory";

/**
 * S3 客户端单例。
 *
 * - `client`：只要配置了凭证即可用，供预签名等与存储模式无关的场景使用。
 * - `storageClient`：额外要求 MULTER_STORAGE=s3，与上传/审核/压缩链路的历史行为一致。
 *
 * 两种入口共享同一个 S3Client 实例，避免每个 service 各建一份连接池。
 */
@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly options: S3ConnectionOptions;
  private readonly sharedClient?: S3Client;

  constructor(configService: ConfigService) {
    this.options = resolveS3ConnectionOptions(configService);

    if (!hasS3Credentials(this.options)) {
      if (this.options.storageType === "s3") {
        this.logger.warn("S3 credentials not configured");
      }
      return;
    }

    this.sharedClient = createS3Client(this.options);
  }

  get client(): S3Client | undefined {
    return this.sharedClient;
  }

  get storageClient(): S3Client | undefined {
    return this.options.storageType === "s3" ? this.sharedClient : undefined;
  }

  get bucket(): string {
    return this.options.bucket;
  }

  get cdnDomain(): string | undefined {
    return this.options.cdnDomain;
  }

  buildPublicUrl(key: string): string {
    return buildS3PublicUrl(this.options, key);
  }
}
