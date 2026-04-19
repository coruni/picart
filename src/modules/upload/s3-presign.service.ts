import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import * as path from "path";
import { PresignedUrlDto, PresignedUrlResponseDto } from "./dto/presigned-url.dto";

@Injectable()
export class S3PresignService {
  private readonly logger = new Logger(S3PresignService.name);
  private s3Client: S3Client;

  constructor(private configService: ConfigService) {
    this.initS3Client();
  }

  private initS3Client() {
    const region = this.configService.get("AWS_REGION", "us-east-1");
    const accessKeyId = this.configService.get("AWS_ACCESS_KEY_ID");
    const secretAccessKey = this.configService.get("AWS_SECRET_ACCESS_KEY");
    const endpoint = this.configService.get("AWS_ENDPOINT");
    const forcePathStyle = this.configService.get("AWS_FORCE_PATH_STYLE") === "true";

    if (!accessKeyId || !secretAccessKey) {
      this.logger.warn("S3 credentials not configured for presign");
      return;
    }

    this.s3Client = new S3Client({
      region,
      credentials: { accessKeyId, secretAccessKey },
      ...(endpoint && { endpoint }),
      ...(forcePathStyle && { forcePathStyle: true }),
    });
  }

  /**
   * 生成 S3 预签名上传 URL
   * 前端可直接使用此 URL 上传文件到 S3，不经过后端
   */
  async generatePresignedUrl(dto: PresignedUrlDto): Promise<PresignedUrlResponseDto> {
    if (!this.s3Client) {
      throw new Error("S3 client not initialized");
    }

    const bucket = this.configService.get("AWS_BUCKET");
    if (!bucket) {
      throw new Error("S3 bucket not configured");
    }

    const { filename, contentType, size } = dto;

    // 验证文件类型和大小
    this.validateFile(dto);

    // 生成存储路径
    const key = this.generateKey(filename);

    // 创建预签名URL（PUT请求）
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      // 限制上传文件大小
      ContentLength: size,
    });

    // URL过期时间（默认5分钟）
    const expiresIn = this.configService.get("S3_PRESIGN_EXPIRES", 300);

    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn,
    });

    // 构建访问URL
    const accessUrl = this.buildAccessUrl(key);

    return {
      uploadUrl,
      accessUrl,
      key,
      expiresIn,
    };
  }

  /**
   * 生成预签名URL（用于分片上传）
   */
  async generateMultipartPresignedUrl(
    filename: string,
    partNumber: number,
    uploadId: string,
  ): Promise<string> {
    // TODO: 实现分片上传预签名
    throw new Error("Multipart upload not implemented yet");
  }

  private validateFile(dto: PresignedUrlDto): void {
    const { contentType, size } = dto;

    // 检查文件类型
    const allowedTypes = this.getAllowedMimeTypes();
    if (!allowedTypes.includes(contentType)) {
      throw new Error(`不支持的文件类型: ${contentType}`);
    }

    // 检查文件大小
    const maxSize = this.getMaxFileSize(contentType);
    if (size > maxSize) {
      const maxSizeMB = (maxSize / 1024 / 1024).toFixed(1);
      throw new Error(`文件大小超过限制: ${maxSizeMB}MB`);
    }
  }

  private generateKey(filename: string): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    const ext = path.extname(filename).toLowerCase();
    const uuid = randomUUID();

    return `uploads/${year}/${month}/${day}/${uuid}${ext}`;
  }

  private buildAccessUrl(key: string): string {
    const cdnDomain = this.configService.get("AWS_CDN_DOMAIN");
    const endpoint = this.configService.get("AWS_ENDPOINT");
    const bucket = this.configService.get("AWS_BUCKET");
    const forcePathStyle = this.configService.get("AWS_FORCE_PATH_STYLE") === "true";

    if (cdnDomain) {
      return `${cdnDomain.replace(/\/+$/, "")}/${key}`;
    }

    if (endpoint && forcePathStyle) {
      return `${endpoint.replace(/\/+$/, "")}/${bucket}/${key}`;
    }

    return `https://${bucket}.s3.${this.configService.get("AWS_REGION")}.amazonaws.com/${key}`;
  }

  private getAllowedMimeTypes(): string[] {
    const defaultTypes = [
      "image/jpeg", "image/png", "image/gif", "image/webp",
      "image/heic", "image/heif", "image/tiff", "image/avif",
      "video/mp4", "video/webm", "video/quicktime", "video/x-msvideo",
      "video/mpeg", "video/avi", "video/flv", "video/x-flv",
      "audio/mpeg", "audio/wav", "audio/ogg", "audio/aac",
      "application/pdf",
    ];

    const configured = this.configService.get<string>("UPLOAD_ALLOWED_MIME_TYPES");
    if (!configured) return defaultTypes;

    return configured.split(",").map(t => t.trim()).filter(Boolean);
  }

  private getMaxFileSize(mimeType: string): number {
    // 将 MB 转换为字节
    const mbToBytes = (mb: number): number => mb * 1024 * 1024;

    // 图片限制（默认 20MB）
    if (mimeType.startsWith("image/")) {
      const sizeMB = this.configService.get<number>("UPLOAD_MAX_IMAGE_SIZE", 20);
      return mbToBytes(sizeMB);
    }
    // 视频限制（默认 500MB）
    if (mimeType.startsWith("video/")) {
      const sizeMB = this.configService.get<number>("UPLOAD_MAX_VIDEO_SIZE", 500);
      return mbToBytes(sizeMB);
    }
    // 音频限制（默认 50MB）
    if (mimeType.startsWith("audio/")) {
      const sizeMB = this.configService.get<number>("UPLOAD_MAX_AUDIO_SIZE", 50);
      return mbToBytes(sizeMB);
    }
    // 其他（默认 100MB）
    const sizeMB = this.configService.get<number>("UPLOAD_MAX_OTHER_SIZE", 100);
    return mbToBytes(sizeMB);
  }
}
