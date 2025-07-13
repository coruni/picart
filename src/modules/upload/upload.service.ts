import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Upload } from './entities/upload.entity';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { PaginationDto } from 'src/common/dto/pagination.dto';

@Injectable()
export class UploadService {
  constructor(
    @InjectRepository(Upload)
    private uploadRepository: Repository<Upload>,
  ) {}

  /**
   * 计算文件MD5哈希
   */
  private async calculateFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('md5');
      const stream = fs.createReadStream(filePath);

      stream.on('data', (data) => {
        hash.update(data);
      });

      stream.on('end', () => {
        resolve(hash.digest('hex'));
      });

      stream.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * 上传文件（支持去重）
   */
  async uploadFile(files: Array<Express.Multer.File>) {
    if (!files || files.length === 0) {
      throw new BadRequestException('上传文件不能为空');
    }

    const upload = files.map(async (file) => {
      const fileHash = await this.calculateFileHash(file.path);
      const existingUpload = await this.uploadRepository.findOne({
        where: { hash: fileHash },
      });

      if (existingUpload) {
        // 检查已存在记录的文件是否还在
        const existingFileExists = existingUpload.path && fs.existsSync(existingUpload.path);

        if (existingFileExists) {
          // 记录存在且文件也存在，删除新上传的文件
          if (file.path && fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        } else {
          // 记录存在但文件丢失，使用新上传的文件替换
          // 不要删除新上传的文件，而是更新记录信息
          existingUpload.path = file.path;
          existingUpload.filename = file.filename;
          existingUpload.originalName = file.originalname;
          existingUpload.size = file.size;
          existingUpload.mimeType = file.mimetype;

        }

        existingUpload.referenceCount += 1;
        await this.uploadRepository.save(existingUpload);
        return existingUpload;
      }

      const upload = this.uploadRepository.create({
        hash: fileHash,
        originalName: file.originalname,
        filename: file.filename,
        path: file.path,
        size: file.size,
        mimeType: file.mimetype,
        referenceCount: 1,
      });
      return upload;
    });

    const uploadEntities = await Promise.all(upload);
    return await this.uploadRepository.save(uploadEntities);
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
