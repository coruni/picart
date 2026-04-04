import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Upload, UploadStorageType } from "./entities/upload.entity";
import { ImageProcessorService } from "./image-processor.service";
import { ConfigService } from "@nestjs/config";
import * as path from "path";
import * as fs from "fs";

@Injectable()
export class UploadMigrationService {
  private readonly logger = new Logger(UploadMigrationService.name);

  constructor(
    @InjectRepository(Upload)
    private uploadRepository: Repository<Upload>,
    private imageProcessor: ImageProcessorService,
    private configService: ConfigService,
  ) {}

  /**
   * 批量处理未压缩的图片
   * 为已有图片生成缩略图
   */
  async processUncompressedImages(options?: {
    limit?: number;
    dryRun?: boolean;
  }): Promise<{
    processed: number;
    failed: number;
    skipped: number;
    total: number;
  }> {
    const limit = options?.limit || 100;
    const dryRun = options?.dryRun || false;

    // 查询未处理的本地图片
    const uncompressedImages = await this.uploadRepository.find({
      where: {
        storage: UploadStorageType.LOCAL,
        processed: false,
      },
      take: limit,
      order: { createdAt: "DESC" },
    });

    const result = {
      processed: 0,
      failed: 0,
      skipped: 0,
      total: uncompressedImages.length,
    };

    this.logger.log(
      `Found ${uncompressedImages.length} uncompressed images to process`,
    );

    for (const upload of uncompressedImages) {
      try {
        // 检查是否是图片类型
        if (!this.imageProcessor.isSupportedImage(upload.mimeType)) {
          this.logger.debug(`Skipping non-image file: ${upload.originalName}`);
          result.skipped++;
          continue;
        }

        // 检查文件是否存在
        if (!fs.existsSync(upload.path)) {
          this.logger.warn(`File not found: ${upload.path}`);
          result.skipped++;
          continue;
        }

        if (dryRun) {
          this.logger.log(`[DRY RUN] Would process: ${upload.originalName}`);
          result.processed++;
          continue;
        }

        // 处理图片
        await this.processImage(upload);
        result.processed++;
        this.logger.log(
          `Processed ${result.processed}/${result.total}: ${upload.originalName}`,
        );
      } catch (error) {
        result.failed++;
        this.logger.error(`Failed to process image ${upload.id}:`, error);
      }
    }

    this.logger.log(`Batch processing complete: ${JSON.stringify(result)}`);
    return result;
  }

  /**
   * 处理单张图片
   */
  private async processImage(upload: Upload): Promise<void> {
    const compressionEnabled = this.configService.get<boolean>(
      "upload.compression.enabled",
    );

    if (!compressionEnabled) {
      this.logger.warn("Compression is disabled, skipping");
      return;
    }

    const outputDir = path.dirname(upload.path);
    const filename = path.basename(upload.path, path.extname(upload.path));

    const processed = await this.imageProcessor.processImage(
      upload.path,
      outputDir,
      filename,
      outputDir,
    );

    // 更新上传记录
    const thumbnails = Object.entries(processed.sizes).map(([name, info]) => ({
      name,
      url: info.url,
      path: info.path,
      size: info.size,
      width: info.width,
      height: info.height,
    }));

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
      `Image ${upload.id} processed with ${thumbnails.length} thumbnails`,
    );
  }

  /**
   * 获取处理统计
   */
  async getProcessingStats(): Promise<{
    total: number;
    processed: number;
    unprocessed: number;
    imagesOnly: number;
  }> {
    const total = await this.uploadRepository.count();
    const processed = await this.uploadRepository.count({
      where: { processed: true },
    });
    const unprocessed = await this.uploadRepository.count({
      where: { processed: false },
    });

    // 统计图片数量（粗略估计）
    const supportedMimeTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/heic",
      "image/heif",
    ];

    const images = await this.uploadRepository.count({
      where: supportedMimeTypes.map((type) => ({ mimeType: type })),
    });

    return {
      total,
      processed,
      unprocessed,
      imagesOnly: images,
    };
  }

  /**
   * 补充图片元数据（宽高、格式等）
   * 用于已有图片但缺少元数据的情况
   */
  async fillMissingMetadata(limit?: number): Promise<{
    updated: number;
    failed: number;
    total: number;
  }> {
    const take = limit || 100;

    // 查询缺少元数据的图片
    const images = await this.uploadRepository
      .createQueryBuilder("upload")
      .where("upload.storage = :storage", { storage: UploadStorageType.LOCAL })
      .andWhere("upload.original IS NULL")
      .andWhere("upload.thumbnails IS NULL")
      .andWhere("upload.mimeType IN (:...mimeTypes)", {
        mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
      })
      .take(take)
      .orderBy("upload.createdAt", "DESC")
      .getMany();

    const result = {
      updated: 0,
      failed: 0,
      total: images.length,
    };

    this.logger.log(`Found ${images.length} images missing metadata`);

    for (const upload of images) {
      try {
        if (!fs.existsSync(upload.path)) {
          this.logger.warn(`File not found: ${upload.path}`);
          result.failed++;
          continue;
        }

        const metadata = await this.imageProcessor.getMetadata(upload.path);

        upload.original = {
          url: upload.url,
          path: upload.path,
          size: upload.size,
          width: metadata.width,
          height: metadata.height,
        };

        await this.uploadRepository.save(upload);
        result.updated++;

        this.logger.log(
          `Updated metadata for ${upload.originalName}: ${metadata.width}x${metadata.height}`,
        );
      } catch (error) {
        result.failed++;
        this.logger.error(`Failed to update metadata for ${upload.id}:`, error);
      }
    }

    return result;
  }
}
