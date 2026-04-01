import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Upload, UploadStorageType } from './entities/upload.entity';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { createReadStream } from 'fs';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class UploadService {
  constructor(
    @InjectRepository(Upload)
    private uploadRepository: Repository<Upload>,
    private configService: ConfigService,
  ) {}

  private async calculateFileHashFromPath(filePath: string): Promise<string> {
    const hash = crypto.createHash('sha256');

    await new Promise<void>((resolve, reject) => {
      const stream = createReadStream(filePath);
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve());
      stream.on('error', reject);
    });

    return hash.digest('hex');
  }

  async uploadFile(files: Array<Express.Multer.File>, req?: Request) {
    if (!files || files.length === 0) {
      throw new BadRequestException('response.error.uploadFileEmpty');
    }

    const uploads = await Promise.all(
      files.map(async (file) => {
        const fileIdentifier = await this.getFileIdentifier(file);

        const existingUpload = await this.uploadRepository.findOne({
          where: { hash: fileIdentifier },
        });

        if (existingUpload) {
          if (existingUpload.storage === UploadStorageType.LOCAL) {
            const fileExists = existingUpload.path && fs.existsSync(existingUpload.path);
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

        const newUpload = this.uploadRepository.create({
          hash: fileIdentifier,
          originalName: file.originalname,
          filename: file.filename || file.originalname,
          path: file.path || file['key'],
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

  private async getFileIdentifier(file: Express.Multer.File): Promise<string> {
    if (this.configService.get('MULTER_STORAGE') === 's3') {
      return file['etag'] || this.generateS3Identifier(file);
    }

    if (!file.path) {
      throw new Error('Local file path is missing');
    }

    return this.calculateFileHashFromPath(file.path);
  }

  private generateS3Identifier(file: Express.Multer.File): string {
    return `${file['key']}-${file.size}-${file['lastModified']}`;
  }

  private normalizeBaseUrl(url: string): string {
    return url.replace(/\/+$/, '');
  }

  private getRequestBaseUrl(req?: Request): string | undefined {
    if (!req) {
      return undefined;
    }

    const forwardedProto = req.headers['x-forwarded-proto'];
    const forwardedHost = req.headers['x-forwarded-host'];
    const hostHeader = forwardedHost || req.headers.host;

    const protocol = Array.isArray(forwardedProto)
      ? forwardedProto[0]
      : forwardedProto?.split(',')[0]?.trim() || req.protocol;
    const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;

    if (!protocol || !host) {
      return undefined;
    }

    return `${protocol}://${host}`;
  }

  private getFileUrl(file: Express.Multer.File, req?: Request): string {
    if (this.configService.get('MULTER_STORAGE') === 's3') {
      const cdnBaseUrl =
        this.configService.get<string>('AWS_CDN_DOMAIN') || file['metadata']?.['cdnUrl'];
      if (!cdnBaseUrl) {
        throw new Error('AWS_CDN_DOMAIN is required for S3 uploads');
      }

      return `${this.normalizeBaseUrl(cdnBaseUrl)}/${file['key']}`;
    }

    if (!file.path) {
      throw new Error('Local file path is missing');
    }

    const uploadRoot = this.configService.get('MULTER_DEST', 'uploads');
    const uploadsIndex = file.path.indexOf(uploadRoot);
    if (uploadsIndex === -1) {
      throw new Error(`File path does not contain ${uploadRoot} directory`);
    }

    const relativePath = file.path
      .slice(uploadsIndex + uploadRoot.length)
      .replace(/^[\\/]+/, '')
      .replace(/\\/g, '/');
    const relativeUrl = `/uploads/${relativePath}`;
    const requestBaseUrl = this.getRequestBaseUrl(req);

    if (requestBaseUrl) {
      return `${this.normalizeBaseUrl(requestBaseUrl)}${relativeUrl}`;
    }

    return relativeUrl;
  }

  async getFileInfo(id: number) {
    return await this.uploadRepository.findOne({
      where: { id },
    });
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
      if (upload.storage === UploadStorageType.LOCAL && fs.existsSync(upload.path)) {
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
    sortOrder?: 'ASC' | 'DESC',
  ): Promise<Upload[]> {
    const order: Record<string, 'ASC' | 'DESC'> = {};
    if (sortBy === 'createdAt' && (sortOrder === 'ASC' || sortOrder === 'DESC')) {
      order.createdAt = sortOrder;
    } else {
      order.createdAt = 'DESC';
    }

    return await this.uploadRepository.find({
      order,
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    });
  }

  async remove(id: number) {
    return await this.decreaseReferenceCount(id);
  }
}
