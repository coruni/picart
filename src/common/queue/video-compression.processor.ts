import { Processor, Process, OnQueueFailed, OnQueueStalled, OnQueueCompleted, OnQueueWaiting } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Upload, UploadStorageType } from '../../modules/upload/entities/upload.entity';
import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

interface VideoCompressionJob {
  uploadId: number;
  filePath: string;
  mimeType: string;
  storage: UploadStorageType;
}

interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  bitrate: number;
  fps: number;
}

@Processor('video-compression')
export class VideoCompressionProcessor {
  private readonly logger = new Logger(VideoCompressionProcessor.name);
  private s3Client: S3Client;

  constructor(
    @InjectRepository(Upload)
    private uploadRepository: Repository<Upload>,
    private configService: ConfigService,
  ) {
    this.initS3Client();
  }

  private initS3Client() {
    const storageType = this.configService.get('MULTER_STORAGE', 'local');
    if (storageType !== 's3') return;

    const region = this.configService.get('AWS_REGION', 'us-east-1');
    const accessKeyId = this.configService.get('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get('AWS_SECRET_ACCESS_KEY');
    const endpoint = this.configService.get('AWS_ENDPOINT');
    const forcePathStyle = this.configService.get('AWS_FORCE_PATH_STYLE') === 'true';

    if (!accessKeyId || !secretAccessKey) {
      this.logger.warn('S3 credentials not configured');
      return;
    }

    this.s3Client = new S3Client({
      region,
      credentials: { accessKeyId, secretAccessKey },
      ...(endpoint && { endpoint }),
      ...(forcePathStyle && { forcePathStyle: true }),
    });
  }

  @Process({ concurrency: 2 })
  async handleVideoCompression(job: Job<VideoCompressionJob>) {
    const { uploadId, filePath, storage } = job.data;

    this.logger.log(`Processing video compression job ${job.id} for upload ${uploadId}`);

    const upload = await this.uploadRepository.findOne({ where: { id: uploadId } });
    if (!upload) {
      this.logger.warn(`Upload ${uploadId} not found`);
      return { success: false, reason: 'upload_not_found' };
    }

    // 检查是否已经压缩过
    if (upload.videoCompressionStatus === 'completed') {
      this.logger.log(`Video ${uploadId} already compressed`);
      return { success: true, reason: 'already_compressed' };
    }

    // 更新状态为处理中
    upload.videoCompressionStatus = 'processing';
    await this.uploadRepository.save(upload);

    try {
      const result = await this.compressVideo(upload, filePath, storage);

      upload.videoCompressionStatus = 'completed';
      upload.videoCompressionJob = {
        originalSize: result.originalSize,
        compressedSize: result.compressedSize,
        compressionRatio: result.compressionRatio,
        startedAt: new Date(job.timestamp),
        completedAt: new Date(),
      };
      await this.uploadRepository.save(upload);

      this.logger.log(`Video ${uploadId} compressed successfully. ` +
        `Original: ${this.formatBytes(result.originalSize)}, ` +
        `Compressed: ${this.formatBytes(result.compressedSize)}, ` +
        `Ratio: ${(result.compressionRatio * 100).toFixed(1)}%`);

      return { success: true, compressionRatio: result.compressionRatio };
    } catch (error) {
      this.logger.error(`Video compression failed for ${uploadId}:`, error);

      upload.videoCompressionStatus = 'failed';
      upload.videoCompressionJob = {
        originalSize: fs.existsSync(filePath) ? fs.statSync(filePath).size : 0,
        compressedSize: 0,
        compressionRatio: 0,
        startedAt: new Date(job.timestamp),
        completedAt: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      await this.uploadRepository.save(upload);

      throw error;
    }
  }

  private async compressVideo(
    upload: Upload,
    sourcePath: string,
    storage: UploadStorageType,
  ): Promise<{ originalSize: number; compressedSize: number; compressionRatio: number }> {
    // 如果是 S3 存储，需要先下载到本地临时文件
    let localPath = sourcePath;
    let tempDownloadPath: string | null = null;

    if (storage === UploadStorageType.S3) {
      tempDownloadPath = await this.downloadS3VideoToTemp(upload);
      localPath = tempDownloadPath;
    }

    const originalSize = fs.existsSync(localPath) ? fs.statSync(localPath).size : upload.size;

    // 获取视频元数据
    const metadata = await this.getVideoMetadata(localPath);
    this.logger.log(`Video metadata for ${upload.id}: ${metadata.width}x${metadata.height}, ` +
      `${metadata.duration}s, ${this.formatBytes(metadata.bitrate)}/s`);

    // 根据原视频质量和大小决定压缩策略
    const compressionConfig = this.getCompressionConfig(metadata, originalSize);

    // 创建临时压缩文件路径
    const tempDir = path.join(process.cwd(), 'temp', 'video-compression');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const compressedFilename = `compressed_${upload.filename}`;
    const compressedPath = path.join(tempDir, compressedFilename);

    // 执行压缩
    await this.runFfmpeg(localPath, compressedPath, compressionConfig);

    const compressedSize = fs.statSync(compressedPath).size;
    const compressionRatio = (originalSize - compressedSize) / originalSize;

    // 只有当压缩率超过10%且压缩后文件更小，才替换原文件
    if (compressionRatio > 0.1 && compressedSize < originalSize) {
      if (storage === UploadStorageType.LOCAL) {
        // 本地存储：直接替换原文件
        fs.unlinkSync(sourcePath);
        fs.copyFileSync(compressedPath, sourcePath);
        fs.unlinkSync(compressedPath);

        // 更新数据库记录的文件大小
        upload.size = compressedSize;
        await this.uploadRepository.save(upload);

        this.logger.log(`Replaced original video with compressed version for ${upload.id}`);
      } else if (storage === UploadStorageType.S3 && this.s3Client) {
        // S3 存储：上传压缩后的文件，替换原文件
        await this.replaceS3Video(upload, compressedPath, sourcePath);
      }
    } else {
      // 压缩效果不明显，删除临时文件，保留原文件
      fs.unlinkSync(compressedPath);
      this.logger.log(`Compression not beneficial for ${upload.id}, keeping original. ` +
        `Ratio: ${(compressionRatio * 100).toFixed(1)}%`);
    }

    // 清理 S3 下载的临时文件
    if (tempDownloadPath && fs.existsSync(tempDownloadPath)) {
      fs.unlinkSync(tempDownloadPath);
    }

    return {
      originalSize,
      compressedSize: Math.min(compressedSize, originalSize),
      compressionRatio: Math.max(0, compressionRatio),
    };
  }

  /**
   * 下载 S3 视频到本地临时文件
   */
  private async downloadS3VideoToTemp(upload: Upload): Promise<string> {
    if (!this.s3Client) {
      throw new Error('S3 client not initialized');
    }

    const tempDir = path.join(process.cwd(), 'temp', 'video-compression');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempPath = path.join(tempDir, `download_${upload.filename}`);

    this.logger.log(`Downloading S3 video ${upload.id} to ${tempPath}`);

    // 尝试使用 HTTP 下载
    try {
      const response = await fetch(upload.url);
      if (response.ok) {
        const buffer = Buffer.from(await response.arrayBuffer());
        fs.writeFileSync(tempPath, buffer);
        this.logger.log(`Downloaded S3 video ${upload.id} via HTTP`);
        return tempPath;
      }
    } catch (fetchErr) {
      this.logger.warn(`Failed to download via HTTP for ${upload.id}, trying S3 SDK:`, fetchErr);
    }

    // 如果 HTTP 失败，使用 S3 SDK
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const bucket = this.configService.get('AWS_BUCKET');
    if (!bucket) {
      throw new Error('S3 bucket not configured');
    }

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: upload.path,
    });

    const response = await this.s3Client.send(command);
    const stream = response.Body as NodeJS.ReadableStream;

    return new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(tempPath);
      stream.pipe(writeStream);
      writeStream.on('finish', () => {
        this.logger.log(`Downloaded S3 video ${upload.id} via S3 SDK`);
        resolve(tempPath);
      });
      writeStream.on('error', reject);
    });
  }

  private async runFfmpeg(
    inputPath: string,
    outputPath: string,
    config: { crf: number; preset: string; maxWidth?: number; maxHeight?: number; videoBitrate?: string },
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const command = ffmpeg(inputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .addOption('-crf', config.crf.toString())
        .addOption('-preset', config.preset)
        .addOption('-movflags', '+faststart'); // 优化网络播放

      // 如果需要调整分辨率
      if (config.maxWidth || config.maxHeight) {
        command.size(`${config.maxWidth || '?'}x${config.maxHeight || '?'}`)
          .autopad();
      }

      // 如果指定了视频码率
      if (config.videoBitrate) {
        command.videoBitrate(config.videoBitrate);
      }

      command
        .on('start', (cmd: string) => {
          this.logger.debug(`FFmpeg command: ${cmd}`);
        })
        .on('progress', (progress: { percent?: number }) => {
          this.logger.debug(`Processing: ${progress.percent?.toFixed(1)}% done`);
        })
        .on('end', () => {
          resolve();
        })
        .on('error', (err: Error) => {
          reject(err);
        })
        .save(outputPath);
    });
  }

  private async getVideoMetadata(filePath: string): Promise<VideoMetadata> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }

        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        if (!videoStream) {
          reject(new Error('No video stream found'));
          return;
        }

        const duration = parseFloat(String(metadata.format.duration || '0'));
        const width = videoStream.width || 0;
        const height = videoStream.height || 0;
        const bitrate = parseInt(String(metadata.format.bit_rate || '0'), 10);
        const fps = eval(String(videoStream.r_frame_rate || '0'));

        resolve({
          duration,
          width,
          height,
          bitrate,
          fps,
        });
      });
    });
  }

  private getCompressionConfig(metadata: VideoMetadata, fileSize: number): { crf: number; preset: string; maxWidth?: number; maxHeight?: number; videoBitrate?: string } {
    // 读取配置
    const configCrf = this.configService.get<number>('upload.videoCompression.crf', 23);
    const configPreset = this.configService.get<string>('upload.videoCompression.preset', 'medium');
    const configMaxWidth = this.configService.get<number>('upload.videoCompression.maxWidth', 1920);
    const configMaxHeight = this.configService.get<number>('upload.videoCompression.maxHeight', 1080);
    const configBitrate = this.configService.get<string>('upload.videoCompression.videoBitrate', '5000k');
    const minFileSize = this.configService.get<number>('upload.videoCompression.minFileSize', 10 * 1024 * 1024);

    // 如果文件小于最小压缩阈值，不调整分辨率
    if (fileSize < minFileSize) {
      return {
        crf: configCrf,
        preset: configPreset,
      };
    }

    // 根据原视频质量和文件大小动态调整压缩参数
    const isHighQuality = metadata.bitrate > 5000000; // > 5Mbps
    const isLargeFile = fileSize > 100 * 1024 * 1024; // > 100MB
    const isHighResolution = metadata.width > configMaxWidth || metadata.height > configMaxHeight;

    // 基础配置使用配置的默认值
    const config: { crf: number; preset: string; maxWidth?: number; maxHeight?: number; videoBitrate?: string } = {
      crf: configCrf,
      preset: configPreset,
    };

    // 高清视频降低一些质量以节省空间（但如果配置已经很激进了就不调整）
    if (isHighQuality && configCrf < 28) {
      config.crf = Math.min(configCrf + 3, 28);
    }

    // 大文件使用更快的编码以节省CPU
    if (isLargeFile) {
      const fasterPresets = ['ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium'];
      const currentIndex = fasterPresets.indexOf(configPreset);
      if (currentIndex >= 0 && currentIndex < fasterPresets.length - 1) {
        config.preset = fasterPresets[currentIndex + 1];
      }
    }

    // 高分辨率视频降分辨率
    if (isHighResolution) {
      config.maxWidth = configMaxWidth;
      config.maxHeight = configMaxHeight;
      config.videoBitrate = configBitrate;
    }

    return config;
  }

  private async replaceS3Video(upload: Upload, compressedPath: string, _originalPath: string): Promise<void> {
    if (!this.s3Client) {
      throw new Error('S3 client not initialized');
    }

    const bucket = this.configService.get('AWS_BUCKET');
    if (!bucket) {
      throw new Error('S3 bucket not configured');
    }

    try {
      // 删除原文件
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: upload.path,
        }),
      );

      // 上传压缩后的文件（使用相同的 key）
      const fileContent = fs.readFileSync(compressedPath);
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: upload.path,
          Body: fileContent,
          ContentType: upload.mimeType,
          ACL: 'public-read',
        }),
      );

      // 更新文件大小
      upload.size = fs.statSync(compressedPath).size;
      await this.uploadRepository.save(upload);

      // 清理临时文件
      fs.unlinkSync(compressedPath);

      this.logger.log(`Replaced S3 video for ${upload.id}`);
    } catch (error) {
      this.logger.error(`Failed to replace S3 video for ${upload.id}:`, error);
      throw error;
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  @OnQueueFailed()
  onFailed(job: Job<VideoCompressionJob>, err: Error) {
    this.logger.error(
      `Video compression job ${job.id} failed for upload ${job.data.uploadId} after ${job.attemptsMade} attempts:`,
      err.message,
    );
  }

  @OnQueueStalled()
  onStalled(job: Job<VideoCompressionJob>) {
    this.logger.warn(
      `Video compression job ${job.id} for upload ${job.data.uploadId} is stalled and will be reprocessed`,
    );
  }

  @OnQueueCompleted()
  onCompleted(job: Job<VideoCompressionJob>, result: any) {
    this.logger.log(
      `Video compression job ${job.id} for upload ${job.data.uploadId} completed:`,
      result,
    );
  }

  @OnQueueWaiting()
  onWaiting(jobId: number) {
    this.logger.log(`Video compression job ${jobId} is waiting to be processed`);
  }
}
