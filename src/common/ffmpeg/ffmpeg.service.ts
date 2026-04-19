import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import ffmpeg = require('fluent-ffmpeg');
import * as path from 'path';
import * as fs from 'fs';

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  bitrate: number;
  fps: number;
  format: string;
  codec: string;
}

export interface CompressionOptions {
  inputPath: string;
  outputPath: string;
  crf?: number;
  preset?: string;
  maxWidth?: number;
  maxHeight?: number;
  videoBitrate?: string;
  audioBitrate?: string;
}

export interface CompressionProgress {
  percent?: number;
  frame?: number;
  fps?: number;
  size?: string;
  time?: string;
  bitrate?: string;
  speed?: string;
}

@Injectable()
export class FFmpegService implements OnModuleInit {
  private readonly logger = new Logger(FFmpegService.name);
  private isAvailable: boolean = false;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    this.initialize();
  }

  private initialize(): void {
    this.tryInitWithSystemPath();
  }

  /**
   * 尝试使用系统 PATH 中的 FFmpeg
   */
  private tryInitWithSystemPath(): void {
    const ffmpegExe = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
    const ffprobeExe = process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe';

    // PATH 环境变量（Windows 不区分大小写）
    const pathEnv = process.env.PATH || process.env.Path || process.env.path || '';
    const separator = process.platform === 'win32' ? ';' : ':';
    const pathDirs = pathEnv.split(separator).filter(Boolean);

    this.logger.debug(`Scanning ${pathDirs.length} directories in PATH for FFmpeg...`);

    let ffmpegPath: string | null = null;
    let ffprobePath: string | null = null;

    for (const dir of pathDirs) {
      const possibleFfmpeg = path.join(dir.trim(), ffmpegExe);
      const possibleFfprobe = path.join(dir.trim(), ffprobeExe);

      if (!ffmpegPath && fs.existsSync(possibleFfmpeg)) {
        ffmpegPath = possibleFfmpeg;
        this.logger.debug(`Found ffmpeg: ${possibleFfmpeg}`);
      }
      if (!ffprobePath && fs.existsSync(possibleFfprobe)) {
        ffprobePath = possibleFfprobe;
        this.logger.debug(`Found ffprobe: ${possibleFfprobe}`);
      }

      if (ffmpegPath) break;
    }

    if (ffmpegPath) {
      this.logger.log(`Found FFmpeg in system PATH: ${ffmpegPath}`);
      ffmpeg.setFfmpegPath(ffmpegPath);
      if (ffprobePath) {
        ffmpeg.setFfprobePath(ffprobePath);
      }
      this.isAvailable = true;
      return;
    }

    this.logger.warn('FFmpeg not found in system PATH, trying FFMPEG_PATH env...');
    this.tryInitWithEnvPath();
  }

  /**
   * 使用 FFMPEG_PATH 环境变量初始化
   */
  private tryInitWithEnvPath(): void {
    const ffmpegPath = this.configService.get<string>('FFMPEG_PATH');
    const ffprobePath = this.configService.get<string>('FFPROBE_PATH');

    if (!ffmpegPath) {
      this.logger.warn('FFMPEG_PATH not configured. Video compression will be disabled.');
      this.isAvailable = false;
      return;
    }

    this.logger.log(`Trying FFmpeg from env: ${ffmpegPath}`);

    ffmpeg.setFfmpegPath(ffmpegPath);
    if (ffprobePath) {
      ffmpeg.setFfprobePath(ffprobePath);
    }

    ffmpeg.getAvailableFormats((err) => {
      if (err) {
        this.logger.error(`FFmpeg not available at ${ffmpegPath}:`, err.message);
        this.isAvailable = false;
      } else {
        this.logger.log(`FFmpeg/FFprobe is available from FFMPEG_PATH: ${ffmpegPath}`);
        this.isAvailable = true;
      }
    });
  }

  /**
   * 检查 FFmpeg 是否可用
   */
  isFFmpegAvailable(): boolean {
    return this.isAvailable;
  }

  /**
   * 获取视频元数据
   */
  async getVideoMetadata(filePath: string): Promise<VideoMetadata> {
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
        const format = metadata.format.format_name || 'unknown';
        const codec = videoStream.codec_name || 'unknown';

        resolve({
          duration,
          width,
          height,
          bitrate,
          fps,
          format,
          codec,
        });
      });
    });
  }

  /**
   * 压缩视频
   */
  async compressVideo(
    options: CompressionOptions,
    onProgress?: (progress: CompressionProgress) => void,
  ): Promise<void> {
    const {
      inputPath,
      outputPath,
      crf = 23,
      preset = 'medium',
      maxWidth,
      maxHeight,
      videoBitrate,
      audioBitrate = '128k',
    } = options;

    return new Promise((resolve, reject) => {
      const command = ffmpeg(inputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .addOption('-crf', crf.toString())
        .addOption('-preset', preset)
        .addOption('-movflags', '+faststart');

      // 调整分辨率
      if (maxWidth || maxHeight) {
        command.size(`${maxWidth || '?'}x${maxHeight || '?'}`).autopad();
      }

      // 视频码率
      if (videoBitrate) {
        command.videoBitrate(videoBitrate);
      }

      // 音频码率
      if (audioBitrate) {
        command.audioBitrate(audioBitrate);
      }

      if (onProgress) {
        command.on('progress', onProgress);
      }

      command
        .on('start', (cmd: string) => {
          this.logger.debug(`FFmpeg command: ${cmd}`);
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

  /**
   * 生成缩略图
   */
  async generateThumbnail(
    inputPath: string,
    outputPath: string,
    options?: {
      time?: string; // 截图时间点，如 '00:00:01'
      width?: number;
      height?: number;
    },
  ): Promise<void> {
    const { time = '00:00:01', width, height } = options || {};

    return new Promise((resolve, reject) => {
      const command = ffmpeg(inputPath)
        .seekInput(time)
        .frames(1);

      if (width || height) {
        command.size(`${width || '?'}x${height || '?'}`);
      }

      command
        .on('end', () => resolve())
        .on('error', (err: Error) => reject(err))
        .save(outputPath);
    });
  }

  /**
   * 获取视频时长（秒）
   */
  async getDuration(filePath: string): Promise<number> {
    const metadata = await this.getVideoMetadata(filePath);
    return metadata.duration;
  }

  /**
   * 获取视频分辨率
   */
  async getResolution(filePath: string): Promise<{ width: number; height: number }> {
    const metadata = await this.getVideoMetadata(filePath);
    return { width: metadata.width, height: metadata.height };
  }
}
