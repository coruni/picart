import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import {
  Upload,
  UploadStorageType,
  ThumbnailInfo,
} from "./entities/upload.entity";
import * as crypto from "crypto";
import * as fs from "fs";
import { createReadStream } from "fs";
import { PaginationDto } from "src/common/dto/pagination.dto";
import { ConfigService } from "@nestjs/config";
import { ConfigService as DbConfigService } from "../config/config.service";
import { Request } from "express";
import { ImageProcessorService } from "./image-processor.service";
import * as path from "path";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import * as mime from "mime-types";

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private s3Client: S3Client;
  private readonly BLOCKED_IMAGE_PATH = "/images/blocked.webp";
  private readonly PENDING_IMAGE_PATH = "/images/pending.webp";
  private readonly IMAGE_AUDIT_JOB_PREFIX = "image-audit:";

  constructor(
    @InjectRepository(Upload)
    private uploadRepository: Repository<Upload>,
    private configService: ConfigService,
    private dbConfigService: DbConfigService,
    private imageProcessor: ImageProcessorService,
    @InjectQueue('image-audit') private imageAuditQueue: Queue,
    @InjectQueue('video-compression') private videoCompressionQueue: Queue,
  ) {
    // 初始化 S3 客户端
    this.initS3Client();
  }

  private initS3Client() {
    const storageType = this.configService.get("MULTER_STORAGE", "local");
    if (storageType !== "s3") {
      return;
    }

    const region = this.configService.get("AWS_REGION", "us-east-1");
    const accessKeyId = this.configService.get("AWS_ACCESS_KEY_ID");
    const secretAccessKey = this.configService.get("AWS_SECRET_ACCESS_KEY");
    const endpoint = this.configService.get("AWS_ENDPOINT");
    const forcePathStyle =
      this.configService.get("AWS_FORCE_PATH_STYLE") === "true";

    if (!accessKeyId || !secretAccessKey) {
      this.logger.warn("S3 credentials not configured");
      return;
    }

    this.s3Client = new S3Client({
      region,
      credentials: { accessKeyId, secretAccessKey },
      ...(endpoint && { endpoint }),
      ...(forcePathStyle && { forcePathStyle: true }),
    });
  }

  private async uploadToS3(
    filePath: string,
    key: string,
    contentType?: string,
  ): Promise<string> {
    if (!this.s3Client) {
      throw new Error("S3 client not initialized");
    }

    const bucket = this.configService.get("AWS_BUCKET");
    if (!bucket) {
      throw new Error("S3 bucket not configured");
    }

    const fileContent = fs.readFileSync(filePath);
    const mimeType =
      contentType || mime.lookup(filePath) || "application/octet-stream";

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: fileContent,
      ContentType: mimeType,
      ACL: "public-read",
    });

    await this.s3Client.send(command);

    // 返回 S3 URL
    const cdnDomain = this.configService.get("AWS_CDN_DOMAIN");
    const endpoint = this.configService.get("AWS_ENDPOINT");
    const forcePathStyle =
      this.configService.get("AWS_FORCE_PATH_STYLE") === "true";

    if (cdnDomain) {
      return `${cdnDomain.replace(/\/+$/, "")}/${key}`;
    }

    if (endpoint && forcePathStyle) {
      return `${endpoint.replace(/\/+$/, "")}/${bucket}/${key}`;
    }

    return `https://${bucket}.s3.${this.configService.get("AWS_REGION")}.amazonaws.com/${key}`;
  }

  private async calculateFileHashFromPath(filePath: string): Promise<string> {
    const hash = crypto.createHash("sha256");

    await new Promise<void>((resolve, reject) => {
      const stream = createReadStream(filePath);
      stream.on("data", (chunk) => hash.update(chunk));
      stream.on("end", () => resolve());
      stream.on("error", reject);
    });

    return hash.digest("hex");
  }

  async uploadFile(
    files: Array<Express.Multer.File>,
    req?: Request,
    metadata?: Array<{ hash?: string; name?: string }>,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException("response.error.uploadFileEmpty");
    }

    // 验证每个文件的大小限制
    for (const file of files) {
      this.validateFileSize(file);
    }

    const uploads = await Promise.all(
      files.map(async (file, index) => {
        // 优先使用 metadata 中对应索引的 hash，否则后端计算
        const providedHash = metadata?.[index]?.hash;
        const fileIdentifier = providedHash || (await this.getFileIdentifier(file));

        const existingUpload = await this.uploadRepository.findOne({
          where: { hash: fileIdentifier },
        });

        if (existingUpload) {
          // 检查图片审核是否开启
          const imageAuditEnabled = await this.dbConfigService.getCachedConfig('content_audit_image_enabled', false);

          // 如果同样的文件之前审核被拒绝，且开启了图片审核，则拒绝
          if (existingUpload.auditStatus === "rejected" && imageAuditEnabled === true) {
            // 删除新上传的文件
            if (file.path && fs.existsSync(file.path)) {
              fs.unlinkSync(file.path);
            }
            this.logger.warn(`Duplicate rejected hash ${fileIdentifier}, blocking upload`);
            // 增加引用计数，返回原记录（URL 保持不变，前端根据 auditStatus 显示占位图）
            existingUpload.referenceCount += 1;
            await this.uploadRepository.save(existingUpload);
            return existingUpload;
          }

          if (existingUpload.storage === UploadStorageType.LOCAL) {
            const fileExists =
              existingUpload.path && fs.existsSync(existingUpload.path);
            if (!fileExists) {
              existingUpload.path = file.path;
              existingUpload.filename = file.filename;
              existingUpload.url = this.getFileUrl(file, req);
            }
          }

          if (
            this.imageProcessor.isSupportedImage(existingUpload.mimeType) &&
            imageAuditEnabled !== true &&
            existingUpload.auditStatus === "pending"
          ) {
            existingUpload.auditStatus = "approved";
          }

          existingUpload.referenceCount += 1;
          await this.uploadRepository.save(existingUpload);
          return existingUpload;
        }

        // 创建上传记录
        const newUpload = this.uploadRepository.create({
          hash: fileIdentifier,
          originalName: file.originalname,
          filename: file.filename || file.originalname,
          path: file.path || file["key"],
          url: this.getFileUrl(file, req),
          size: file.size,
          mimeType: file.mimetype,
          storage:
            this.configService.get("MULTER_STORAGE") === "s3"
              ? UploadStorageType.S3
              : UploadStorageType.LOCAL,
          referenceCount: 1,
          processed: false,
          thumbnails: null,
          original: null,
        });

        const savedUpload = await this.uploadRepository.save(newUpload);

        // 判断是否开启图片审核（用于后续压缩完成后触发审核）
        let imageAuditEnabled = false;
        if (this.imageProcessor.isSupportedImage(file.mimetype)) {
          imageAuditEnabled = await this.dbConfigService.getCachedConfig('content_audit_image_enabled', false);
          if (imageAuditEnabled !== true) {
            // 未开启图片审核，直接标记为通过
            savedUpload.auditStatus = 'approved';
            await this.uploadRepository.save(savedUpload);
          }
        }

        // 如果是本地存储的图片，异步处理压缩
        if (
          savedUpload.storage === UploadStorageType.LOCAL &&
          this.imageProcessor.isSupportedImage(file.mimetype)
        ) {
          // 获取图片元数据（宽高、格式等）
          try {
            const metadata = await this.imageProcessor.getMetadata(file.path);
            savedUpload.original = {
              url: savedUpload.url,
              path: savedUpload.path,
              size: savedUpload.size,
              width: metadata.width,
              height: metadata.height,
            };
            await this.uploadRepository.save(savedUpload);
          } catch (err) {
            this.logger.warn(
              `Failed to get metadata for ${savedUpload.id}:`,
              err,
            );
          }

          // 异步处理图片压缩，完成后自动触发审核（避免文件竞争）
          this.processImageAsync(savedUpload, file.path, req, imageAuditEnabled === true).catch((err) => {
            this.logger.error(
              `Image processing failed for ${savedUpload.id}:`,
              err,
            );
          });
        }

        // 如果是 S3 存储的图片，也异步处理
        if (
          savedUpload.storage === UploadStorageType.S3 &&
          this.imageProcessor.isSupportedImage(file.mimetype)
        ) {
          // S3 上传后异步处理（下载、压缩、再上传），完成后自动触发审核
          this.processS3ImageAsync(savedUpload, req, imageAuditEnabled === true).catch((err) => {
            this.logger.error(
              `S3 image processing failed for ${savedUpload.id}:`,
              err,
            );
          });
        }

        // 如果是视频文件，异步提交到视频压缩队列（闲时压缩）
        if (this.isVideoFile(file.mimetype)) {
          const videoCompressionEnabled = this.configService.get<boolean>(
            'upload.videoCompression.enabled',
            true,
          );
          if (videoCompressionEnabled) {
            this.queueVideoCompression(savedUpload, file.path).catch((err) => {
              this.logger.error(
                `Failed to queue video compression for ${savedUpload.id}:`,
                err,
              );
            });
          } else {
            savedUpload.videoCompressionStatus = 'completed';
            await this.uploadRepository.save(savedUpload);
          }
        }

        return savedUpload;
      }),
    );

    // 处理返回的 URL，将相对路径转换为完整 URL
    const requestBaseUrl = this.getRequestBaseUrl(req);
    return uploads.map((upload) => this.formatUploadResponse(upload, requestBaseUrl));
  }

  /**
   * 异步处理图片压缩，完成后可选触发审核
   */
  private async processImageAsync(
    upload: Upload,
    filePath: string,
    req?: Request,
    shouldAudit: boolean = false,
  ) {
    const compressionEnabled = this.configService.get<boolean>(
      "upload.compression.enabled",
    );
    if (!compressionEnabled) {
      // 压缩未启用，直接触发审核
      if (shouldAudit) {
        await this.processImageAuditAsync(upload, req);
      }
      return;
    }

    try {
      const outputDir = path.dirname(filePath);
      const filename = path.basename(filePath, path.extname(filePath));

      const processed = await this.imageProcessor.processImage(
        filePath,
        outputDir,
        filename,
        outputDir,
      );

      // 更新上传记录
      const thumbnails: ThumbnailInfo[] = Object.entries(processed.sizes).map(
        ([name, info]) => ({
          name,
          url: info.url,
          path: info.path,
          size: info.size,
          width: info.width,
          height: info.height,
        }),
      );

      upload.thumbnails = thumbnails;

      if (processed.original) {
        upload.original = {
          url: processed.original.url,
          path: processed.original.path,
          size: processed.original.size,
          width: processed.original.width,
          height: processed.original.height,
        };
      }

      upload.processed = true;
      await this.uploadRepository.save(upload);

      this.logger.log(
        `Image ${upload.id} processed successfully with ${thumbnails.length} thumbnails`,
      );

      // 压缩完成后触发审核（避免文件竞争）
      if (shouldAudit) {
        await this.processImageAuditAsync(upload, req);
      }
    } catch (error) {
      this.logger.error(`Failed to process image ${upload.id}:`, error);
      // 即使压缩失败，也尝试触发审核（使用原始文件）
      if (shouldAudit) {
        await this.processImageAuditAsync(upload, req);
      }
    }
  }

  /**
   * 后台异步审核图片 - 添加到队列
   * 由队列处理器执行实际审核
   */
  private async processImageAuditAsync(upload: Upload, req?: Request) {
    try {
      // 如果 hash 已存在且被拒绝，直接处理为拒绝
      const existingAudit = await this.uploadRepository.findOne({
        where: { hash: upload.hash, auditStatus: "rejected" },
        cache: false,
      });
      if (existingAudit) {
        this.logger.warn(`Image ${upload.id} hash ${upload.hash} was previously rejected`);
        upload.auditStatus = "rejected";
        upload.url = this.getRequestBaseUrl(req) + this.BLOCKED_IMAGE_PATH;
        await this.uploadRepository.save(upload);
        return;
      }

      // 将审核任务添加到队列
      await this.imageAuditQueue.add(
        {
          uploadId: upload.id,
          url: upload.url,
          hash: upload.hash,
          userId: null,
          baseUrl: this.getRequestBaseUrl(req),
        },
        {
          jobId: `${this.IMAGE_AUDIT_JOB_PREFIX}${upload.id}`,
          attempts: 10,
          backoff: {
            type: 'fixed',
            delay: 5000,
          },
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      );

      this.logger.log(`Image audit job queued for upload ${upload.id}`);
    } catch (error) {
      this.logger.error(`Failed to queue image audit for ${upload.id}:`, error);
    }
  }

  /**
   * 处理审核不通过的图片
   * 删除原图并替换为占位图
   */
  private async handleBlockedImage(upload: Upload, req?: Request) {
    try {
      // 删除本地文件
      if (upload.storage === UploadStorageType.LOCAL && upload.path && fs.existsSync(upload.path)) {
        fs.unlinkSync(upload.path);
        // 删除缩略图
        if (upload.thumbnails) {
          for (const thumb of upload.thumbnails) {
            if (thumb.path && fs.existsSync(thumb.path)) {
              fs.unlinkSync(thumb.path);
            }
          }
        }
        // 删除原图备份
        if (upload.original?.path && fs.existsSync(upload.original.path)) {
          fs.unlinkSync(upload.original.path);
        }
      }

      // 删除 S3 文件
      if (upload.storage === UploadStorageType.S3 && this.s3Client) {
        try {
          await this.s3Client.send(
            new DeleteObjectCommand({
              Bucket: this.configService.get("AWS_BUCKET"),
              Key: upload.path,
            })
          );
        } catch (err) {
          this.logger.warn(`Failed to delete S3 object ${upload.path}:`, err);
        }
      }

      // 替换 URL 为占位图
      const requestBaseUrl = this.getRequestBaseUrl(req);
      upload.url = `${requestBaseUrl}${this.BLOCKED_IMAGE_PATH}`;
      upload.thumbnails = null;
      upload.original = null;
      await this.uploadRepository.save(upload);
    } catch (error) {
      this.logger.error(`Failed to handle blocked image ${upload.id}:`, error);
    }
  }

  /**
   * 异步处理 S3 图片
   * 下载 -> 处理 -> 上传回 S3，完成后可选触发审核
   */
  private async processS3ImageAsync(upload: Upload, req?: Request, shouldAudit: boolean = false) {
    const compressionEnabled = this.configService.get<boolean>(
      "upload.compression.enabled",
    );
    if (!compressionEnabled) {
      // 压缩未启用，直接触发审核
      if (shouldAudit) {
        await this.processImageAuditAsync(upload, req);
      }
      return;
    }

    if (!this.s3Client) {
      this.logger.warn(
        "S3 client not initialized, skipping S3 image processing",
      );
      // S3 客户端未初始化，直接触发审核
      if (shouldAudit) {
        await this.processImageAuditAsync(upload, req);
      }
      return;
    }

    try {
      // 从 S3 URL 下载到临时目录处理
      const tempDir = path.join(process.cwd(), "temp");
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const filename = path.basename(upload.path);
      const tempPath = path.join(tempDir, filename);

      // 下载图片
      this.logger.log(`Downloading S3 image ${upload.id} from ${upload.url}`);
      await this.downloadFromS3(upload.url, tempPath);

      // 获取元数据
      try {
        const metadata = await this.imageProcessor.getMetadata(tempPath);
        upload.original = {
          url: upload.url,
          path: upload.path,
          size: upload.size,
          width: metadata.width,
          height: metadata.height,
        };
        await this.uploadRepository.save(upload);
        this.logger.log(
          `Saved metadata for S3 image ${upload.id}: ${metadata.width}x${metadata.height}`,
        );
      } catch (err) {
        this.logger.warn(
          `Failed to get metadata for S3 image ${upload.id}:`,
          err,
        );
      }

      // 处理图片生成缩略图
      this.logger.log(`Processing S3 image ${upload.id}...`);
      const processed = await this.imageProcessor.processImage(
        tempPath,
        tempDir,
        path.basename(filename, path.extname(filename)),
        tempDir,
      );

      // 提取原图的基础路径（不包含文件名）
      const originalKey = upload.path;
      const baseKey = originalKey.substring(0, originalKey.lastIndexOf("/"));

      // 上传缩略图到 S3
      const thumbnails: ThumbnailInfo[] = [];

      for (const [name, info] of Object.entries(processed.sizes)) {
        const thumbKey = `${baseKey}/${path.basename(info.path)}`;

        try {
          this.logger.log(`Uploading thumbnail to S3: ${thumbKey}`);
          const thumbUrl = await this.uploadToS3(info.path, thumbKey);

          thumbnails.push({
            name,
            url: thumbUrl,
            path: info.path,
            size: info.size,
            width: info.width,
            height: info.height,
          });

          this.logger.log(`Uploaded ${name} thumbnail: ${thumbUrl}`);
        } catch (uploadErr) {
          this.logger.error(`Failed to upload ${name} thumbnail:`, uploadErr);
        }
      }

      // 上传原图压缩版本（如果启用了保留原图）
      if (processed.original) {
        try {
          const originalKeyPath = `${baseKey}/${path.basename(processed.original.path)}`;
          this.logger.log(
            `Uploading compressed original to S3: ${originalKeyPath}`,
          );
          const originalUrl = await this.uploadToS3(
            processed.original.path,
            originalKeyPath,
          );

          upload.original = {
            url: originalUrl,
            path: processed.original.path,
            size: processed.original.size,
            width: processed.original.width,
            height: processed.original.height,
          };

          this.logger.log(`Uploaded compressed original: ${originalUrl}`);
        } catch (uploadErr) {
          this.logger.error("Failed to upload compressed original:", uploadErr);
        }
      }

      upload.thumbnails = thumbnails;
      upload.processed = true;
      await this.uploadRepository.save(upload);

      // 清理临时文件
      try {
        fs.unlinkSync(tempPath);
        Object.values(processed.sizes).forEach((size) => {
          if (fs.existsSync(size.path)) {
            fs.unlinkSync(size.path);
          }
        });
        if (processed.original && fs.existsSync(processed.original.path)) {
          fs.unlinkSync(processed.original.path);
        }
      } catch (cleanupErr) {
        this.logger.warn(
          `Failed to cleanup temp files for ${upload.id}:`,
          cleanupErr,
        );
      }

      this.logger.log(
        `S3 Image ${upload.id} processed successfully with ${thumbnails.length} thumbnails`,
      );

      // 压缩完成后触发审核（避免文件竞争）
      if (shouldAudit) {
        await this.processImageAuditAsync(upload, req);
      }
    } catch (error) {
      this.logger.error(`Failed to process S3 image ${upload.id}:`, error);
      // 即使压缩失败，也尝试触发审核
      if (shouldAudit) {
        await this.processImageAuditAsync(upload, req);
      }
    }
  }

  /**
   * 从 S3 下载文件
   */
  private async downloadFromS3(url: string, destPath: string): Promise<void> {
    // 尝试使用 HTTP 下载（适用于公开 bucket 或 CDN）
    try {
      const response = await fetch(url);
      if (response.ok) {
        const buffer = Buffer.from(await response.arrayBuffer());
        fs.writeFileSync(destPath, buffer);
        return;
      }
    } catch (fetchErr) {
      this.logger.warn(`Failed to download via HTTP, trying S3 SDK:`, fetchErr);
    }

    // 如果 HTTP 失败且是 S3 URL，使用 S3 SDK
    if (!this.s3Client) {
      throw new Error("S3 client not initialized");
    }

    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const bucket = this.configService.get("AWS_BUCKET");

    // 从 URL 中提取 key
    let key: string;
    if (url.includes(`${bucket}.s3.`)) {
      // 标准 S3 URL: https://bucket.s3.region.amazonaws.com/key
      const urlObj = new URL(url);
      key = urlObj.pathname.substring(1);
    } else if (url.includes("/" + bucket + "/")) {
      // 路径样式: https://s3.endpoint/bucket/key
      const parts = url.split(`/${bucket}/`);
      key = parts[1];
    } else {
      // 其他情况（CDN），尝试从 upload.path 获取
      key = url.substring(url.lastIndexOf("/") + 1);
    }

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await this.s3Client.send(command);
    const stream = response.Body as NodeJS.ReadableStream;

    return new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(destPath);
      stream.pipe(writeStream);
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });
  }

  private async getFileIdentifier(file: Express.Multer.File): Promise<string> {
    if (this.configService.get("MULTER_STORAGE") === "s3") {
      return file["etag"] || this.generateS3Identifier(file);
    }

    if (!file.path) {
      throw new Error("Local file path is missing");
    }

    return this.calculateFileHashFromPath(file.path);
  }

  private generateS3Identifier(file: Express.Multer.File): string {
    return `${file["key"]}-${file.size}-${file["lastModified"]}`;
  }

  private normalizeBaseUrl(url: string): string {
    return url.replace(/\/+$/, "");
  }

  private getRequestBaseUrl(req?: Request): string | undefined {
    if (!req) {
      return undefined;
    }

    const forwardedProto = req.headers["x-forwarded-proto"];
    const forwardedHost = req.headers["x-forwarded-host"];
    const hostHeader = forwardedHost || req.headers.host;

    const protocol = Array.isArray(forwardedProto)
      ? forwardedProto[0]
      : forwardedProto?.split(",")[0]?.trim() || req.protocol;
    const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;

    if (!protocol || !host) {
      return undefined;
    }

    return `${protocol}://${host}`;
  }

  private getFileUrl(file: Express.Multer.File, req?: Request): string {
    if (this.configService.get("MULTER_STORAGE") === "s3") {
      const cdnBaseUrl =
        this.configService.get<string>("AWS_CDN_DOMAIN") ||
        file["metadata"]?.["cdnUrl"];
      if (!cdnBaseUrl) {
        throw new Error("AWS_CDN_DOMAIN is required for S3 uploads");
      }

      return `${this.normalizeBaseUrl(cdnBaseUrl)}/${file["key"]}`;
    }

    if (!file.path) {
      throw new Error("Local file path is missing");
    }

    const uploadRoot = this.configService.get("MULTER_DEST", "uploads");
    const uploadsIndex = file.path.indexOf(uploadRoot);
    if (uploadsIndex === -1) {
      throw new Error(`File path does not contain ${uploadRoot} directory`);
    }

    const relativePath = file.path
      .slice(uploadsIndex + uploadRoot.length)
      .replace(/^[\\/]+/, "")
      .replace(/\\/g, "/");
    const relativeUrl = `/uploads/${relativePath}`;
    const requestBaseUrl = this.getRequestBaseUrl(req);

    if (requestBaseUrl) {
      return `${this.normalizeBaseUrl(requestBaseUrl)}${relativeUrl}`;
    }

    return relativeUrl;
  }

  /**
   * 处理 Upload 实体的 URL，将相对路径转换为完整 URL
   */
  private formatUploadResponse(upload: Upload, baseUrl?: string): Upload {
    if (!upload) return upload;

    const blockedUrl = baseUrl
      ? `${this.normalizeBaseUrl(baseUrl)}${this.BLOCKED_IMAGE_PATH}`
      : this.BLOCKED_IMAGE_PATH;

    if (upload.auditStatus === "rejected") {
      return {
        ...upload,
        url: blockedUrl,
        original: null,
        thumbnails: null,
      };
    }

    // 从主 URL 提取基础域名
    const domain = baseUrl || this.extractBaseUrl(upload.url);
    if (!domain) return upload;

    // 处理原图 URL（如果是相对路径）
    if (upload.original && !upload.original.url.startsWith("http")) {
      upload.original.url = `${domain}${upload.original.url.startsWith("/") ? "" : "/"}${upload.original.url}`;
    }

    // 处理缩略图 URL（如果是相对路径）
    if (upload.thumbnails && upload.thumbnails.length > 0) {
      upload.thumbnails = upload.thumbnails.map((thumb) => ({
        ...thumb,
        url: thumb.url.startsWith("http")
          ? thumb.url
          : `${domain}${thumb.url.startsWith("/") ? "" : "/"}${thumb.url}`,
      }));
    }

    return upload;
  }

  /**
   * 从完整 URL 中提取基础域名
   */
  private extractBaseUrl(url: string): string | undefined {
    try {
      const urlObj = new URL(url);
      return `${urlObj.protocol}//${urlObj.host}`;
    } catch {
      return undefined;
    }
  }

  async getFileInfo(id: number, req?: Request) {
    const upload = await this.uploadRepository.findOne({
      where: { id },
    });
    if (!upload) return null;

    return this.formatUploadResponse(upload);
  }

  async getFilePath(id: number) {
    const upload = await this.getFileInfo(id);
    return upload?.path;
  }

  async decreaseReferenceCount(id: number): Promise<void> {
    const upload = await this.getFileInfo(id);
    if (!upload) {
      return;
    }

    upload.referenceCount -= 1;

    if (upload.referenceCount <= 0) {
      if (
        upload.storage === UploadStorageType.LOCAL &&
        fs.existsSync(upload.path)
      ) {
        fs.unlinkSync(upload.path);
      }
      await this.uploadRepository.remove(upload);
      return;
    }

    await this.uploadRepository.save(upload);
  }

  async findAll(
    pagination: PaginationDto,
    sortBy?: string,
    sortOrder?: "ASC" | "DESC",
  ): Promise<Upload[]> {
    const order: Record<string, "ASC" | "DESC"> = {};
    if (
      sortBy === "createdAt" &&
      (sortOrder === "ASC" || sortOrder === "DESC")
    ) {
      order.createdAt = sortOrder;
    } else {
      order.createdAt = "DESC";
    }

    const uploads = await this.uploadRepository.find({
      order,
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    });

    return uploads.map((upload) => this.formatUploadResponse(upload));
  }

  async remove(id: number) {
    return await this.decreaseReferenceCount(id);
  }

  /**
   * 确认 S3 直传完成，创建数据库记录
   * 前端使用预签名URL上传到S3后，调用此接口通知后端
   */
  async confirmS3Upload(
    data: {
      key: string;
      url: string;
      originalName: string;
      mimeType: string;
      size: number;
      hash?: string;
    },
    req?: Request,
  ): Promise<Upload> {
    const { key, url, originalName, mimeType, size, hash } = data;

    // 检查文件是否已存在（基于hash或key）
    const fileIdentifier = hash || key;
    const existingUpload = await this.uploadRepository.findOne({
      where: { hash: fileIdentifier },
    });

    if (existingUpload) {
      // 如果同样的文件之前审核被拒绝，则拒绝
      const imageAuditEnabled = await this.dbConfigService.getCachedConfig('content_audit_image_enabled', false);
      if (existingUpload.auditStatus === "rejected" && imageAuditEnabled === true) {
        this.logger.warn(`Duplicate rejected hash ${fileIdentifier}, blocking upload`);
        existingUpload.referenceCount += 1;
        await this.uploadRepository.save(existingUpload);
        return this.formatUploadResponse(existingUpload, this.getRequestBaseUrl(req));
      }

      if (
        this.imageProcessor.isSupportedImage(existingUpload.mimeType) &&
        imageAuditEnabled !== true &&
        existingUpload.auditStatus === "pending"
      ) {
        existingUpload.auditStatus = "approved";
      }

      // 增加引用计数
      existingUpload.referenceCount += 1;
      await this.uploadRepository.save(existingUpload);
      return this.formatUploadResponse(existingUpload, this.getRequestBaseUrl(req));
    }

    // 创建新的上传记录
    const newUpload = this.uploadRepository.create({
      hash: fileIdentifier,
      originalName,
      filename: key.split('/').pop() || originalName,
      path: key,
      url,
      size,
      mimeType,
      storage: UploadStorageType.S3,
      referenceCount: 1,
      processed: false,
      thumbnails: null,
      original: null,
    });

    const savedUpload = await this.uploadRepository.save(newUpload);

    // 如果是图片且开启了图片审核，后台异步审核
    if (this.imageProcessor.isSupportedImage(mimeType)) {
      const imageAuditEnabled = await this.dbConfigService.getCachedConfig('content_audit_image_enabled', false);
      if (imageAuditEnabled === true) {
        this.processImageAuditAsync(savedUpload, req).catch((err) => {
          this.logger.error(`Image audit failed for ${savedUpload.id}:`, err);
        });
      } else {
        savedUpload.auditStatus = 'approved';
        await this.uploadRepository.save(savedUpload);
      }

      // 异步处理图片压缩
      const compressionEnabled = this.configService.get<boolean>("upload.compression.enabled");
      if (compressionEnabled) {
        this.processS3ImageAsync(savedUpload, req).catch((err) => {
          this.logger.error(`S3 image processing failed for ${savedUpload.id}:`, err);
        });
      }
    }

    // 如果是视频文件，异步提交到视频压缩队列
    if (this.isVideoFile(mimeType)) {
      const videoCompressionEnabled = this.configService.get<boolean>(
        'upload.videoCompression.enabled',
        true,
      );
      if (videoCompressionEnabled) {
        // S3视频压缩需要特殊处理：下载 -> 压缩 -> 上传
        this.queueS3VideoCompression(savedUpload).catch((err) => {
          this.logger.error(`Failed to queue S3 video compression for ${savedUpload.id}:`, err);
        });
      } else {
        savedUpload.videoCompressionStatus = 'completed';
        await this.uploadRepository.save(savedUpload);
      }
    }

    return this.formatUploadResponse(savedUpload, this.getRequestBaseUrl(req));
  }

  /**
   * 将 S3 视频加入压缩队列
   */
  private async queueS3VideoCompression(upload: Upload): Promise<void> {
    try {
      upload.videoCompressionStatus = 'pending';
      await this.uploadRepository.save(upload);

      await this.videoCompressionQueue.add({
        uploadId: upload.id,
        filePath: upload.path, // S3 key
        mimeType: upload.mimeType,
        storage: UploadStorageType.S3,
      }, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 10000,
        },
        delay: 5000,
        timeout: 600000,
        removeOnComplete: 50,
        removeOnFail: 10,
      });

      this.logger.log(`S3 Video compression job queued for upload ${upload.id}`);
    } catch (error) {
      this.logger.error(`Failed to queue S3 video compression for ${upload.id}:`, error);
      upload.videoCompressionStatus = 'failed';
      upload.videoCompressionJob = {
        originalSize: upload.size,
        compressedSize: 0,
        compressionRatio: 0,
        startedAt: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      await this.uploadRepository.save(upload);
    }
  }

  /**
   * 验证文件大小限制
   */
  private validateFileSize(file: Express.Multer.File): void {
    const mimeType = file.mimetype.toLowerCase();
    let maxSizeMB: number;
    let fileTypeLabel: string;

    // 将 MB 转换为字节的辅助函数
    const mbToBytes = (mb: number): number => mb * 1024 * 1024;

    // 图片类型（默认 20MB）
    if (mimeType.startsWith('image/')) {
      maxSizeMB = this.configService.get<number>('UPLOAD_MAX_IMAGE_SIZE', 20);
      fileTypeLabel = '图片';
    }
    // 视频类型（默认 500MB）
    else if (mimeType.startsWith('video/')) {
      maxSizeMB = this.configService.get<number>('UPLOAD_MAX_VIDEO_SIZE', 500);
      fileTypeLabel = '视频';
    }
    // 音频类型（默认 50MB）
    else if (mimeType.startsWith('audio/')) {
      maxSizeMB = this.configService.get<number>('UPLOAD_MAX_AUDIO_SIZE', 50);
      fileTypeLabel = '音频';
    }
    // 其他类型（默认 100MB）
    else {
      maxSizeMB = this.configService.get<number>('UPLOAD_MAX_OTHER_SIZE', 100);
      fileTypeLabel = '文件';
    }

    // 转换为字节
    let maxSize = mbToBytes(maxSizeMB);

    // 向后兼容：检查是否配置了旧的通用限制（字节单位）
    const legacyMaxSize = this.configService.get<number>('UPLOAD_MAX_FILE_SIZE');
    if (legacyMaxSize && legacyMaxSize > 0) {
      // 如果当前类型的限制大于旧限制，使用旧限制（保持向后兼容的严格性）
      maxSize = Math.min(maxSize, legacyMaxSize);
    }

    if (file.size > maxSize) {
      const maxSizeDisplay = (maxSize / 1024 / 1024).toFixed(1);
      const fileSizeMB = (file.size / 1024 / 1024).toFixed(1);
      throw new BadRequestException(
        `${fileTypeLabel}大小超过限制: ${fileSizeMB}MB > ${maxSizeDisplay}MB`
      );
    }
  }

  /**
   * 检查是否为视频文件
   */
  private isVideoFile(mimeType: string): boolean {
    const videoTypes = [
      'video/mp4',
      'video/webm',
      'video/ogg',
      'video/quicktime', // mov
      'video/x-msvideo', // avi
      'video/x-matroska', // mkv
      'video/avi',
      'video/mpeg',
      'video/flv',
      'video/x-flv',
    ];
    return videoTypes.some(type => mimeType.toLowerCase().includes(type));
  }

  /**
   * 将视频压缩任务添加到队列（闲时异步处理）
   */
  private async queueVideoCompression(upload: Upload, filePath: string): Promise<void> {
    try {
      // 检查文件是否存在（S3上传时文件可能不在本地）
      if (upload.storage === UploadStorageType.LOCAL && !fs.existsSync(filePath)) {
        this.logger.warn(`Video file not found for compression: ${filePath}`);
        upload.videoCompressionStatus = 'failed';
        upload.videoCompressionJob = {
          originalSize: upload.size,
          compressedSize: 0,
          compressionRatio: 0,
          startedAt: new Date(),
          error: 'File not found',
        };
        await this.uploadRepository.save(upload);
        return;
      }

      // 更新状态为等待处理
      upload.videoCompressionStatus = 'pending';
      await this.uploadRepository.save(upload);

      // 添加到视频压缩队列
      await this.videoCompressionQueue.add({
        uploadId: upload.id,
        filePath: upload.storage === UploadStorageType.LOCAL ? filePath : upload.path,
        mimeType: upload.mimeType,
        storage: upload.storage,
      }, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 10000,
        },
        // 延迟处理，让队列在"闲时"处理（上传完成后立即添加，但队列可以配置低优先级）
        delay: 5000,
        timeout: 600000,
        removeOnComplete: 50,
        removeOnFail: 10,
      });

      this.logger.log(`Video compression job queued for upload ${upload.id}`);
    } catch (error) {
      this.logger.error(`Failed to queue video compression for ${upload.id}:`, error);
      // 队列添加失败，标记为失败状态
      upload.videoCompressionStatus = 'failed';
      upload.videoCompressionJob = {
        originalSize: upload.size,
        compressedSize: 0,
        compressionRatio: 0,
        startedAt: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      await this.uploadRepository.save(upload);
    }
  }
}
