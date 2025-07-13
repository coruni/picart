import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Upload, UploadStorageType } from './entities/upload.entity';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';

@Injectable()
export class UploadService {
  constructor(
    @InjectRepository(Upload)
    private uploadRepository: Repository<Upload>,
    private configService: ConfigService,
  ) {}

  /**
   * 计算文件MD5哈希
   */
  private async calculateFileHash(buffer: Buffer): Promise<string> {
    const hash = crypto.createHash('sha256');
    hash.update(buffer);
    return hash.digest('hex');
  }

  /**
   * 上传文件（支持去重）
   */
  async uploadFile(files: Array<Express.Multer.File>, req: Request) {
    if (!files || files.length === 0) {
      throw new BadRequestException('上传文件不能为空');
    }

    const uploads = await Promise.all(
      files.map(async (file) => {
        // 1. 计算文件唯一标识（本地用 buffer 哈希，S3 用 ETag 或自定义逻辑）
        const fileIdentifier = await this.getFileIdentifier(file);

        // 2. 检查是否已存在相同文件记录
        const existingUpload = await this.uploadRepository.findOne({
          where: { hash: fileIdentifier },
        });

        if (existingUpload) {
          // 3. 本地存储：校验文件是否存在
          if (existingUpload.storage === UploadStorageType.LOCAL) {
            const fileExists = existingUpload.path && fs.existsSync(existingUpload.path);
            if (!fileExists) {
              // 文件丢失，更新记录为新文件
              existingUpload.path = file.path;
              existingUpload.filename = file.filename;
            }
          }
          // 4. 增加引用计数（本地/S3 通用逻辑）
          existingUpload.referenceCount += 1;
          await this.uploadRepository.save(existingUpload);
          return existingUpload;
        }

        // 5. 新文件：创建记录
        const newUpload = this.uploadRepository.create({
          hash: fileIdentifier,
          originalName: file.originalname,
          filename: file.filename || file.originalname,
          path: file.path || file['key'], // S3 用 key，本地用 path
          url: this.getFileUrl(file, req),
          size: file.size,
          mimeType: file.mimetype,
          storage:
            this.configService.get('MULTER_STORAGE') === 's3'
              ? UploadStorageType.S3
              : UploadStorageType.LOCAL,
          referenceCount: 1,
        });

        return this.uploadRepository.save(newUpload);
      }),
    );

    return uploads;
  }

  // 从本地路径读取文件并计算哈希
  private async calculateFileHashFromPath(filePath: string): Promise<string> {
    const buffer = await fs.promises.readFile(filePath);
    return this.calculateFileHash(buffer);
  }

  // 根据存储类型生成文件唯一标识
  private async getFileIdentifier(file: Express.Multer.File): Promise<string> {
    if (this.configService.get('MULTER_STORAGE') === 's3') {
      // S3 模式：使用 ETag 或自定义逻辑
      return file['etag'] || this.generateS3Identifier(file);
    } else {
      // 本地模式：计算文件哈希

      if (!file.path) throw new Error('Local file path is missing!');
      return this.calculateFileHashFromPath(file.path);
    }
  }

  // S3 自定义标识（示例：拼接 key + size + lastModified）
  private generateS3Identifier(file: Express.Multer.File): string {
    return `${file['key']}-${file.size}-${file['lastModified']}`;
  }

  private getFileUrl(file: Express.Multer.File, req: Request): string {
    if (this.configService.get('MULTER_STORAGE') === 's3') {
      return file['metadata']['cdnUrl'] + file['key'];
    } else {
      // 直接提取配置的目录之后的部分
      const uploadsIndex = file.path.indexOf(this.configService.get('MULTER_DEST', 'uploads'));
      if (uploadsIndex === -1) {
        throw new Error(
          `File path does not contain ${this.configService.get('MULTER_DEST', 'uploads')} directory`,
        );
      }

      const relativePath = file.path.slice(uploadsIndex).replace(/\\/g, '/');

      // 获取主机和端口
      let host = req.headers['host']?.split(':')[0];
      const port = req.headers['host']?.split(':')[1];

      // 使用 request['protocol'] 获取协议
      let protocol = req['protocol'] || 'http';

      // 如果端口存在且不是标准端口，拼接端口
      if (port && port != '443' && port != '80') {
        host = `${host}:${port}`;
      }

      // 返回完整的 URL
      return `${protocol}://${host}/static/${relativePath}`;
    }
  }

  /**
   * 获取文件信息
   */
  async getFileInfo(id: number) {
    return await this.uploadRepository.findOne({
      where: { id },
    });
  }

  /**
   * 获取文件路径
   */
  async getFilePath(id: number) {
    const upload = await this.getFileInfo(id);
    return upload?.path;
  }

  /**
   * 减少文件引用计数
   */
  async decreaseReferenceCount(id: number): Promise<void> {
    const upload = await this.getFileInfo(id);

    upload!.referenceCount -= 1;

    if (upload!.referenceCount <= 0) {
      // 如果没有引用，删除文件
      if (fs.existsSync(upload!.path)) {
        fs.unlinkSync(upload!.path);
      }
      await this.uploadRepository.remove(upload!);
    } else {
      await this.uploadRepository.save(upload!);
    }
  }

  /**
   * 获取所有上传文件
   */
  async findAll(pagination: PaginationDto): Promise<Upload[]> {
    return await this.uploadRepository.find({
      order: { createdAt: 'DESC' },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    });
  }

  /**
   * 删除上传文件
   */
  async remove(id: number) {
    return await this.decreaseReferenceCount(id);
  }
}
