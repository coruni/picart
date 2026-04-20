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

  isSupportedImage(mimeType: string): boolean {
    const supportedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/tiff",
      "image/avif",
      "image/heic",
      "image/heif",
    ];
    return supportedTypes.includes(mimeType);
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

    const sourceImage = this.createSharpInstance(sourcePath, metadata);
    const originalWidth = metadata.width || 0;
    const originalHeight = metadata.pageHeight || metadata.height || 0;
    const baseUrl = this.getBaseUrl(storageBasePath);
    const outputFormat = this.getOutputFormat(metadata);

    if (this.config.keepOriginal) {
      const originalExt = `.${outputFormat}`;
      const originalPath = path.join(
        outputDir,
        `${filename}-original${originalExt}`,
      );

      let originalPipeline = sourceImage.clone();

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
      await originalPipeline.toFile(originalPath);

      const stats = fs.statSync(originalPath);
      result.original = {
        url: `${baseUrl}/${filename}-original${originalExt}`,
        path: originalPath,
        size: stats.size,
        width: Math.min(originalWidth, this.config.maxWidth),
        height: Math.min(originalHeight, this.config.maxHeight),
      };
    }

    for (const size of this.config.sizes) {
      try {
        const processed = await this.generateThumbnail(
          sourcePath,
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
    sourcePath: string,
    outputDir: string,
    filename: string,
    size: ImageSizeConfig,
    sourceMetadata?: sharp.Metadata,
  ): Promise<{ path: string; size: number; width: number; height: number }> {
    const metadata = sourceMetadata || (await this.readMetadata(sourcePath));
    const outputFormat = this.getOutputFormat(metadata);
    const outputFilename = `${filename}-${size.name}.${outputFormat}`;
    const outputPath = path.join(outputDir, outputFilename);

    let pipeline = this.createSharpInstance(sourcePath, metadata);

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

    await pipeline.toFile(outputPath);
    const stats = fs.statSync(outputPath);
    const outputMetadata = await this.readMetadata(outputPath);

    return {
      path: outputPath,
      size: stats.size,
      width: outputMetadata.width || 0,
      height: outputMetadata.pageHeight || outputMetadata.height || 0,
    };
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
    // 使用流式读取，避免长时间占用文件句柄
    const stream = fs.createReadStream(sourcePath);
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      return sharp(buffer, {
        animated: true,
        pages: -1,
      }).metadata();
    } finally {
      stream.close();
    }
  }

  private createSharpInstance(
    sourcePath: string,
    metadata?: sharp.Metadata,
  ): sharp.Sharp {
    // 使用流式读取，避免长时间占用文件句柄
    const buffer = fs.readFileSync(sourcePath);

    if (this.isAnimatedGif(metadata)) {
      return sharp(buffer, {
        animated: true,
        pages: -1,
      });
    }

    return sharp(buffer);
  }

  private isAnimatedGif(metadata?: sharp.Metadata): boolean {
    return metadata?.format === "gif" && (metadata.pages || 1) > 1;
  }

  private getOutputFormat(
    metadata?: sharp.Metadata,
  ): UploadConfig["format"] | "webp" {
    if (this.isAnimatedGif(metadata)) {
      return "webp";
    }

    return this.config.format;
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
          mixed: this.isAnimatedGif(metadata),
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
