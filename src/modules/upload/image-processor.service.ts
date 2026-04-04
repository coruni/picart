import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as sharp from "sharp";
import * as path from "path";
import * as fs from "fs";
import { ImageSizeConfig, UploadConfig } from "src/config/upload.config";

export interface ProcessedImage {
  original?: {
    url: string;
    path: string;
    size: number;
    width: number;
    height: number;
  };
  sizes: {
    [key: string]: {
      url: string;
      path: string;
      size: number;
      width: number;
      height: number;
    };
  };
}

@Injectable()
export class ImageProcessorService {
  private readonly logger = new Logger(ImageProcessorService.name);
  private config: UploadConfig;

  constructor(private configService: ConfigService) {
    const uploadConfig =
      this.configService.get<UploadConfig>("upload.compression");
    this.config = uploadConfig || {
      enabled: false,
      format: "webp",
      quality: 80,
      keepOriginal: true,
      maxWidth: 3840,
      maxHeight: 2160,
      sizes: [],
    };
  }

  /**
   * 检查是否为支持的图片类型
   */
  isSupportedImage(mimeType: string): boolean {
    const supportedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/tiff",
      "image/avif",
      "image/heic", // Apple HEIC 格式
      "image/heif", // Apple HEIF 格式
    ];
    return supportedTypes.includes(mimeType);
  }

  /**
   * 处理图片：生成多尺寸缩略图
   * @param sourcePath 原图路径
   * @param outputDir 输出目录
   * @param filename 文件名（不含扩展名）
   * @param storageBasePath 存储基础路径（用于生成 URL）
   */
  async processImage(
    sourcePath: string,
    outputDir: string,
    filename: string,
    storageBasePath: string,
  ): Promise<ProcessedImage> {
    // 如果压缩未启用，直接返回原图信息
    if (!this.config.enabled) {
      const stats = fs.statSync(sourcePath);
      const metadata = await sharp(sourcePath).metadata();
      const ext = path.extname(sourcePath);
      const baseUrl = this.getBaseUrl(storageBasePath);

      return {
        original: {
          url: `${baseUrl}/${filename}${ext}`,
          path: sourcePath,
          size: stats.size,
          width: metadata.width || 0,
          height: metadata.height || 0,
        },
        sizes: {},
      };
    }

    const result: ProcessedImage = {
      original: undefined,
      sizes: {},
    };

    // 确保输出目录存在
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 获取原图信息
    const sourceImage = sharp(sourcePath);
    const metadata = await sourceImage.metadata();
    const originalWidth = metadata.width || 0;
    const originalHeight = metadata.height || 0;
    const baseUrl = this.getBaseUrl(storageBasePath);

    // 处理原图（可选：压缩后保存）
    if (this.config.keepOriginal) {
      const originalExt = path.extname(sourcePath);
      const originalPath = path.join(
        outputDir,
        `${filename}-original${originalExt}`,
      );

      // 如果原图尺寸超过限制，进行压缩
      if (
        originalWidth > this.config.maxWidth ||
        originalHeight > this.config.maxHeight
      ) {
        await sourceImage
          .resize(this.config.maxWidth, this.config.maxHeight, {
            fit: "inside",
            withoutEnlargement: true,
          })
          .toFile(originalPath);
      } else {
        // 直接复制原图
        fs.copyFileSync(sourcePath, originalPath);
      }

      const stats = fs.statSync(originalPath);
      result.original = {
        url: `${baseUrl}/${filename}-original${originalExt}`,
        path: originalPath,
        size: stats.size,
        width: Math.min(originalWidth, this.config.maxWidth),
        height: Math.min(originalHeight, this.config.maxHeight),
      };
    }

    // 生成各尺寸缩略图
    for (const size of this.config.sizes) {
      try {
        const processed = await this.generateThumbnail(
          sourcePath,
          outputDir,
          filename,
          size,
        );
        result.sizes[size.name] = {
          ...processed,
          url: `${baseUrl}/${path.basename(processed.path)}`,
        };
      } catch (error) {
        this.logger.error(`Failed to generate ${size.name} thumbnail`, error);
      }
    }

    return result;
  }

  /**
   * 生成单个缩略图
   */
  private async generateThumbnail(
    sourcePath: string,
    outputDir: string,
    filename: string,
    size: ImageSizeConfig,
  ): Promise<{ path: string; size: number; width: number; height: number }> {
    const outputFilename = `${filename}-${size.name}.${this.config.format}`;
    const outputPath = path.join(outputDir, outputFilename);

    let pipeline = sharp(sourcePath);

    // 调整尺寸
    if (size.width || size.height) {
      pipeline = pipeline.resize(size.width, size.height, {
        fit: size.fit,
        withoutEnlargement: true,
      });
    }

    // 根据目标格式设置输出选项
    switch (this.config.format) {
      case "webp":
        pipeline = pipeline.webp({ quality: size.quality });
        break;
      case "jpeg":
        pipeline = pipeline.jpeg({ quality: size.quality, progressive: true });
        break;
      case "png":
        pipeline = pipeline.png({ quality: size.quality });
        break;
      case "avif":
        pipeline = pipeline.avif({ quality: size.quality });
        break;
    }

    await pipeline.toFile(outputPath);
    const stats = fs.statSync(outputPath);
    const metadata = await sharp(outputPath).metadata();

    return {
      path: outputPath,
      size: stats.size,
      width: metadata.width || 0,
      height: metadata.height || 0,
    };
  }

  /**
   * 获取图片元数据
   */
  async getMetadata(sourcePath: string): Promise<{
    width: number;
    height: number;
    size: number;
    format: string;
  }> {
    const metadata = await sharp(sourcePath).metadata();
    const stats = fs.statSync(sourcePath);

    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
      size: stats.size,
      format: metadata.format || "unknown",
    };
  }

  /**
   * 获取基础 URL
   */
  private getBaseUrl(storagePath: string): string {
    // 从路径中提取 uploads 后的相对路径
    const uploadIndex = storagePath.indexOf("uploads");
    if (uploadIndex === -1) {
      return "";
    }
    const relativePath = storagePath.slice(uploadIndex + "uploads".length);
    return `/uploads${relativePath}`.replace(/\\/g, "/");
  }
}
