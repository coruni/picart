import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as sharp from "sharp";
import * as path from "path";
import * as fs from "fs";
import { ImageSizeConfig, UploadConfig } from "src/config/upload.config";
import { IMAGE_PROCESSABLE_MIME_TYPE_SET } from "src/common/constants/media.constants";

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

  isSupportedImage(mimeType: string): boolean {
    return IMAGE_PROCESSABLE_MIME_TYPE_SET.has(mimeType);
  }

  async processImage(
    sourcePath: string,
    outputDir: string,
    filename: string,
    storageBasePath: string,
  ): Promise<ProcessedImage> {
    const metadata = await this.readMetadata(sourcePath);

    if (!this.config.enabled) {
      const stats = fs.statSync(sourcePath);
      const ext = path.extname(sourcePath);
      const baseUrl = this.getBaseUrl(storageBasePath);

      return {
        original: {
          url: `${baseUrl}/${filename}${ext}`,
          path: sourcePath,
          size: stats.size,
          width: metadata.width || 0,
          height: metadata.pageHeight || metadata.height || 0,
        },
        sizes: {},
      };
    }

    const result: ProcessedImage = {
      original: undefined,
      sizes: {},
    };

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const animated = this.isAnimated(metadata);
    const sourceImage = animated
      ? undefined
      : this.createSharpInstance(sourcePath, metadata);
    // 静态图复用同一个解码实例；动图按需解码，避免长期占用源文件句柄
    const getStaticImage = (): sharp.Sharp => {
      if (sourceImage) {
        return sourceImage;
      }
      return this.createSharpInstance(sourcePath, metadata);
    };
    const originalWidth = metadata.width || 0;
    const originalHeight = this.getFrameHeight(metadata);
    const baseUrl = this.getBaseUrl(storageBasePath);
    const outputFormat = this.getOutputFormat(metadata);

    if (this.config.keepOriginal) {
      if (animated) {
        // 动图不做转码：直接复用上传的源文件
        // （转成 WebP/其他容器后，微信小程序、旧版浏览器和部分图片 CDN 只会渲染第一帧，
        //  表现为「上传 GIF 后动画丢失」）
        const stats = fs.statSync(sourcePath);
        result.original = {
          url: `${baseUrl}/${path.basename(sourcePath)}`,
          path: sourcePath,
          size: stats.size,
          width: originalWidth,
          height: originalHeight,
        };
      } else {
        const originalExt = `.${outputFormat}`;
        const originalPath = path.join(
          outputDir,
          `${filename}-original${originalExt}`,
        );

        let originalPipeline = getStaticImage().clone();

        if (
          originalWidth > this.config.maxWidth ||
          originalHeight > this.config.maxHeight
        ) {
          originalPipeline = originalPipeline.resize(
            this.config.maxWidth,
            this.config.maxHeight,
            {
              fit: "inside",
              withoutEnlargement: true,
            },
          );
        }

        originalPipeline = this.applyOutputFormat(
          originalPipeline,
          outputFormat,
          this.config.quality,
          metadata,
        );
        const originalInfo = await originalPipeline.toFile(originalPath);

        result.original = {
          url: `${baseUrl}/${filename}-original${originalExt}`,
          path: originalPath,
          size: originalInfo.size,
          // 用实际输出尺寸，避免只限制了单边时返回错误宽高
          width: originalInfo.width,
          height: originalInfo.height,
        };
      }
    }

    for (const size of this.config.sizes) {
      try {
        const processed = animated
          ? await this.generateAnimatedThumbnail(
              sourcePath,
              outputDir,
              filename,
              size,
              metadata,
            )
          : await this.generateThumbnail(
              // 复用已解码的 sourceImage，避免每个尺寸重新解码源文件
              getStaticImage(),
              outputDir,
              filename,
              size,
              metadata,
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

  private async generateThumbnail(
    sourceImage: sharp.Sharp,
    outputDir: string,
    filename: string,
    size: ImageSizeConfig,
    sourceMetadata?: sharp.Metadata,
  ): Promise<{ path: string; size: number; width: number; height: number }> {
    const metadata = sourceMetadata;
    const outputFormat = this.getOutputFormat(metadata);
    const outputFilename = `${filename}-${size.name}.${outputFormat}`;
    const outputPath = path.join(outputDir, outputFilename);

    let pipeline = sourceImage.clone();

    if (size.width || size.height) {
      pipeline = pipeline.resize(size.width, size.height, {
        fit: size.fit,
        withoutEnlargement: true,
      });
    }

    pipeline = this.applyOutputFormat(
      pipeline,
      outputFormat,
      size.quality,
      metadata,
    );

    const info = await pipeline.toFile(outputPath);

    return {
      path: outputPath,
      size: info.size,
      width: info.width || 0,
      height: this.resolveOutputFrameHeight(info),
    };
  }

  /**
   * 动图缩略图
   *
   * 与静态图不同，这里输出与源文件相同的容器格式（GIF → GIF），保证动画在任何
   * 客户端（含微信小程序）都能播放；同时 sharp 对多帧图片不支持 fit: cover
   * 逐帧裁剪，因此统一按宽度等比缩放，避免帧被拉伸。
   */
  private async generateAnimatedThumbnail(
    sourcePath: string,
    outputDir: string,
    filename: string,
    size: ImageSizeConfig,
    sourceMetadata?: sharp.Metadata,
  ): Promise<{ path: string; size: number; width: number; height: number }> {
    const outputFormat = this.getAnimatedOutputFormat(sourceMetadata);
    const outputFilename = `${filename}-${size.name}.${outputFormat}`;
    const outputPath = path.join(outputDir, outputFilename);

    const targetWidth = this.resolveAnimatedTargetWidth(size, sourceMetadata);
    const sourceWidth = sourceMetadata?.width || 0;

    // 不需要缩小（或尺寸未知）时直接复用源文件，避免二次有损编码
    if (!targetWidth || (sourceWidth && targetWidth >= sourceWidth)) {
      fs.copyFileSync(sourcePath, outputPath);
      return {
        path: outputPath,
        size: fs.statSync(outputPath).size,
        width: sourceWidth,
        height: this.getFrameHeight(sourceMetadata),
      };
    }

    // 只有需要缩放时才真正解码，避免长时间持有源文件句柄
    let pipeline = this.createSharpInstance(sourcePath, sourceMetadata);
    pipeline = pipeline.resize({ width: targetWidth, withoutEnlargement: true });
    pipeline = this.applyAnimatedOutputFormat(
      pipeline,
      outputFormat,
      size.quality,
      sourceMetadata,
    );

    const info = await pipeline.toFile(outputPath);

    return {
      path: outputPath,
      size: info.size,
      width: info.width || 0,
      height: this.resolveOutputFrameHeight(info),
    };
  }

  /**
   * 动图只能按宽度缩放，高度由原帧比例推导
   */
  private resolveAnimatedTargetWidth(
    size: ImageSizeConfig,
    metadata?: sharp.Metadata,
  ): number | undefined {
    if (size.width) {
      return size.width;
    }

    const frameWidth = metadata?.width || 0;
    const frameHeight = this.getFrameHeight(metadata);
    if (size.height && frameWidth && frameHeight) {
      return Math.round((frameWidth * size.height) / frameHeight);
    }

    return undefined;
  }

  /**
   * 输出尺寸中的单帧高度：多帧图片的 height 是拼接后的总高度
   */
  private resolveOutputFrameHeight(info: sharp.OutputInfo): number {
    if (info.pageHeight) {
      return info.pageHeight;
    }

    const pages = info.pages && info.pages > 1 ? info.pages : 1;
    return pages > 1 ? Math.round(info.height / pages) : info.height || 0;
  }

  private getFrameHeight(metadata?: sharp.Metadata): number {
    return metadata?.pageHeight || metadata?.height || 0;
  }

  async getMetadata(sourcePath: string): Promise<{
    width: number;
    height: number;
    size: number;
    format: string;
  }> {
    const metadata = await this.readMetadata(sourcePath);
    const stats = fs.statSync(sourcePath);

    return {
      width: metadata.width || 0,
      height: metadata.pageHeight || metadata.height || 0,
      size: stats.size,
      format: metadata.format || "unknown",
    };
  }

  private async readMetadata(sourcePath: string): Promise<sharp.Metadata> {
    // 交给 libvips 直接读文件头，不再整文件读入内存
    return sharp(sourcePath, {
      animated: true,
      pages: -1,
    }).metadata();
  }

  private createSharpInstance(
    sourcePath: string,
    metadata?: sharp.Metadata,
  ): sharp.Sharp {
    if (this.isAnimated(metadata)) {
      return sharp(sourcePath, {
        animated: true,
        pages: -1,
      });
    }

    return sharp(sourcePath);
  }

  /**
   * 是否为动图（GIF / WebP 多帧）
   */
  private isAnimated(metadata?: sharp.Metadata): boolean {
    return (metadata?.pages || 1) > 1;
  }

  private getOutputFormat(
    metadata?: sharp.Metadata,
  ): UploadConfig["format"] | "webp" {
    // 动图不走转码，这里只服务于静态图
    if (this.isAnimated(metadata)) {
      return "webp";
    }

    return this.config.format;
  }

  /**
   * 动图缩略图保持源容器格式，避免动画在弱兼容客户端丢失
   */
  private getAnimatedOutputFormat(
    metadata?: sharp.Metadata,
  ): "gif" | "webp" {
    return metadata?.format === "webp" ? "webp" : "gif";
  }

  private applyAnimatedOutputFormat(
    pipeline: sharp.Sharp,
    format: "gif" | "webp",
    quality: number,
    metadata?: sharp.Metadata,
  ): sharp.Sharp {
    const loop = metadata?.loop ?? 0;
    const delay = metadata?.delay;

    if (format === "webp") {
      return pipeline.webp({ quality, effort: 6, loop, delay, mixed: true });
    }

    // GIF 编码保留逐帧延时与循环设置，否则动画会变成「瞬切」
    return pipeline.gif({ delay, loop });
  }

  private applyOutputFormat(
    pipeline: sharp.Sharp,
    format: UploadConfig["format"] | "webp",
    quality: number,
    metadata?: sharp.Metadata,
  ): sharp.Sharp {
    switch (format) {
      case "webp":
        return pipeline.webp({
          quality,
          effort: 6,
          loop: metadata?.loop ?? 0,
          delay: metadata?.delay,
          mixed: this.isAnimated(metadata),
        });
      case "jpeg":
        return pipeline.jpeg({ quality, progressive: true });
      case "png":
        return pipeline.png({ quality });
      case "avif":
        return pipeline.avif({ quality });
    }
  }

  private getBaseUrl(storagePath: string): string {
    const uploadIndex = storagePath.indexOf("uploads");
    if (uploadIndex === -1) {
      return "";
    }
    const relativePath = storagePath.slice(uploadIndex + "uploads".length);
    return `/uploads${relativePath}`.replace(/\\/g, "/");
  }
}
