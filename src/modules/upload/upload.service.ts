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
import { Request } from "express";
import { ImageProcessorService } from "./image-processor.service";
import * as path from "path";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import * as mime from "mime-types";

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private s3Client: S3Client;
  private readonly BLOCKED_IMAGE_PATH = "/images/blocked.png";

  constructor(
    @InjectRepository(Upload)
    private uploadRepository: Repository<Upload>,
    private configService: ConfigService,
    private imageProcessor: ImageProcessorService,
    @InjectQueue('image-audit') private imageAuditQueue: Queue,
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

    const uploads = await Promise.all(
      files.map(async (file, index) => {
        // 优先使用 metadata 中对应索引的 hash，否则后端计算
        const providedHash = metadata?.[index]?.hash;
        const fileIdentifier = providedHash || (await this.getFileIdentifier(file));

        const existingUpload = await this.uploadRepository.findOne({
          where: { hash: fileIdentifier },
        });

        if (existingUpload) {
          // 如果同样的文件之前审核被拒绝，直接拒绝
          if (existingUpload.auditStatus === "rejected") {
            // 删除新上传的文件
            if (file.path && fs.existsSync(file.path)) {
              fs.unlinkSync(file.path);
            }
            this.logger.warn(`Duplicate rejected hash ${fileIdentifier}, blocking upload`);
            // 返回已拒绝的记录（URL 已经是错误图片）
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

        // 如果是图片，后台异步审核
        if (this.imageProcessor.isSupportedImage(file.mimetype)) {
          this.processImageAuditAsync(savedUpload, req).catch((err) => {
            this.logger.error(`Image audit failed for ${savedUpload.id}:`, err);
          });
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

          // 异步处理图片压缩（不阻塞上传响应）
          this.processImageAsync(savedUpload, file.path, req).catch((err) => {
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
          // S3 上传后异步处理（下载、压缩、再上传）
          this.processS3ImageAsync(savedUpload, req).catch((err) => {
            this.logger.error(
              `S3 image processing failed for ${savedUpload.id}:`,
              err,
            );
          });
        }

        return savedUpload;
      }),
    );

    // 处理返回的 URL，将相对路径转换为完整 URL
    const requestBaseUrl = this.getRequestBaseUrl(req);
    return uploads.map((upload) => this.formatUploadResponse(upload, requestBaseUrl));
  }

  /**
   * 异步处理图片压缩
   */
  private async processImageAsync(
    upload: Upload,
    filePath: string,
    req?: Request,
  ) {
    const compressionEnabled = this.configService.get<boolean>(
      "upload.compression.enabled",
    );
    if (!compressionEnabled) {
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
    } catch (error) {
      this.logger.error(`Failed to process image ${upload.id}:`, error);
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
      });
      if (existingAudit) {
        this.logger.warn(`Image ${upload.id} hash ${upload.hash} was previously rejected`);
        upload.auditStatus = "rejected";
        upload.url = this.getRequestBaseUrl(req) + this.BLOCKED_IMAGE_PATH;
        await this.uploadRepository.save(upload);
        return;
      }

      // 将审核任务添加到队列
      await this.imageAuditQueue.add({
        uploadId: upload.id,
        url: upload.url,
        hash: upload.hash,
        userId: null,
        baseUrl: this.getRequestBaseUrl(req),
      }, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 50,
      });

      this.logger.log(`Image audit job queued for upload ${upload.id}`);
    } catch (error) {
      this.logger.error(`Failed to queue image audit for ${upload.id}:`, error);
      // 队列添加失败时，标记为通过（降级处理）
      upload.auditStatus = "approved";
      await this.uploadRepository.save(upload);
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
   * 下载 -> 处理 -> 上传回 S3
   */
  private async processS3ImageAsync(upload: Upload, req?: Request) {
    const compressionEnabled = this.configService.get<boolean>(
      "upload.compression.enabled",
    );
    if (!compressionEnabled) {
      return;
    }

    if (!this.s3Client) {
      this.logger.warn(
        "S3 client not initialized, skipping S3 image processing",
      );
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
    } catch (error) {
      this.logger.error(`Failed to process S3 image ${upload.id}:`, error);
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

    // 如果审核失败，URL 已经是占位图路径，不再处理
    if (upload.auditStatus === "rejected") {
      return upload;
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
}
