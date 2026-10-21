import { ConfigService } from "@nestjs/config";
import { S3Client, S3ClientConfig } from "@aws-sdk/client-s3";

export interface S3ConnectionOptions {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
  forcePathStyle: boolean;
  bucket: string;
  cdnDomain?: string;
  storageType: string;
}

export function resolveS3ConnectionOptions(
  configService: ConfigService,
): S3ConnectionOptions {
  return {
    region: configService.get<string>("AWS_REGION") || "us-east-1",
    accessKeyId: configService.get<string>("AWS_ACCESS_KEY_ID") || "",
    secretAccessKey: configService.get<string>("AWS_SECRET_ACCESS_KEY") || "",
    endpoint: configService.get<string>("AWS_ENDPOINT"),
    forcePathStyle: configService.get<string>("AWS_FORCE_PATH_STYLE") === "true",
    bucket: configService.get<string>("AWS_BUCKET") || "",
    cdnDomain: configService.get<string>("AWS_CDN_DOMAIN"),
    storageType: configService.get<string>("MULTER_STORAGE", "local"),
  };
}

export function hasS3Credentials(options: S3ConnectionOptions): boolean {
  return Boolean(options.accessKeyId && options.secretAccessKey);
}

export function createS3Client(options: S3ConnectionOptions): S3Client {
  const clientConfig: S3ClientConfig = {
    region: options.region,
    credentials: {
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey,
    },
  };

  if (options.endpoint) {
    clientConfig.endpoint = options.endpoint;
    clientConfig.forcePathStyle = options.forcePathStyle;
  }

  return new S3Client(clientConfig);
}

/**
 * 拼接对象公开访问地址，优先使用 CDN 域名。
 */
export function buildS3PublicUrl(
  options: Pick<
    S3ConnectionOptions,
    "bucket" | "region" | "endpoint" | "cdnDomain" | "forcePathStyle"
  >,
  key: string,
): string {
  if (options.cdnDomain) {
    return `${options.cdnDomain.replace(/\/+$/, "")}/${key}`;
  }

  if (options.endpoint && options.forcePathStyle) {
    return `${options.endpoint.replace(/\/+$/, "")}/${options.bucket}/${key}`;
  }

  return `https://${options.bucket}.s3.${options.region}.amazonaws.com/${key}`;
}
