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

    for (const [index, size] of this.config.sizes.entries()) {
      try {
        let processed: {
          path: string;
          size: number;
          width: number;
          height: number;
        };

        if (!animated) {
          processed = await this.generateThumbnail(
            // 复用已解码的 sourceImage，避免每个尺寸重新解码源文件
            getStaticImage(),
            outputDir,
            filename,
            size,
            metadata,
          );
        } else if (index === 0 && this.config.staticThumbForAnimated !== false) {
          // 动图的最小尺寸输出静态首帧：列表页只取一张轻量封面，
          // 既不会加载整段动图，也不会因为客户端不支持动图而渲染失败
          processed = await this.generateAnimatedPosterThumbnail(
            sourcePath,
            outputDir,
            filename,
            size,
          );
        } else {
          processed = await this.generateAnimatedThumbnail(
            sourcePath,
            outputDir,
            filename,
            size,
            metadata,
          );
        }

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
   * 动图的静态封面缩略图（首帧）
   *
   * 只解码第一帧并输出 WebP：体积通常只有几 KB，任何客户端都能渲染。
   * 列表页/卡片用它做封面，原图与较大尺寸仍然保留动画。
   */
  private async generateAnimatedPosterThumbnail(
    sourcePath: string,
    outputDir: string,
    filename: string,
    size: ImageSizeConfig,
  ): Promise<{ path: string; size: number; width: number; height: number }> {
    const outputPath = path.join(outputDir, `${filename}-${size.name}.webp`);

    // pages: 1 只解码首帧，避免把整段动图读进内存
    let pipeline = sharp(sourcePath, { pages: 1 });

    if (size.width || size.height) {
      pipeline = pipeline.resize(size.width, size.height, {
        fit: size.fit,
        withoutEnlargement: true,
      });
    }

    const info = await pipeline
      .webp({ quality: size.quality, effort: 6 })
      .toFile(outputPath);

    return {
      path: outputPath,
      size: info.size,
      width: info.width || 0,
      height: info.height || 0,
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
    const { loop, delay } = this.resolveAnimationOptions(metadata);

    if (format === "webp") {
      return pipeline.webp({ quality, effort: 6, loop, delay, mixed: true });
    }

    // GIF 编码保留逐帧延时与循环设置，否则动画会变成「瞬切」
    return pipeline.gif({ delay, loop });
  }

  /**
   * 归一化动画参数
   *
   * libvips 会把「无限循环」读成 65535/65536，而 sharp 只接受 0..65535（0 表示无限），
   * 直接透传会抛 `Expected integer between 0 and 65535 for loop`，
   * 导致真实世界里绝大多数 GIF 根本生成不出缩略图。
   */
  private resolveAnimationOptions(metadata?: sharp.Metadata): {
    loop: number;
    delay: number[];
  } {
    const pages = Math.max(1, metadata?.pages || 1);
    const rawLoop = metadata?.loop;
    const loop =
      typeof rawLoop === "number" && Number.isFinite(rawLoop) && rawLoop < 65535
        ? Math.max(0, Math.round(rawLoop))
        : 0;

    return { loop, delay: this.resolveAnimationDelay(metadata, pages) };
  }

  /**
   * 把延时数组补/裁到与帧数一致，并裁剪到 sharp 允许的整数范围
   */
  private resolveAnimationDelay(
    metadata: sharp.Metadata | undefined,
    pages: number,
  ): number[] {
    const raw = (metadata?.delay || []).filter((value) =>
      Number.isFinite(value),
    );
    const fallback = raw.length > 0 ? raw[raw.length - 1] : 100;
    const delay: number[] = [];

    for (let i = 0; i < pages; i++) {
      const value = raw.length > 0 ? raw[i % raw.length] : fallback;
      delay.push(Math.min(65535, Math.max(0, Math.round(value))));
    }

    return delay;
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
