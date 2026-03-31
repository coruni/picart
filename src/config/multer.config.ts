// multer.config.ts
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import * as multerS3 from 'multer-s3';
import { S3Client, S3ClientConfig } from '@aws-sdk/client-s3';
const DEFAULT_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
  'application/vnd.rar',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'video/mp4',
  'audio/mpeg',
];

const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024;
const DEFAULT_MAX_FILE_COUNT = 10;
// S3配置接口
interface S3Config {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint?: string;
  forcePathStyle?: boolean;
  cdnDomain?: string;
}
// 创建S3客户端
const createS3Client = (config: S3Config): S3Client => {
  const clientConfig: S3ClientConfig = {
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  };

  // 如果配置了自定义端点（如加速域名或兼容S3的服务）
  if (config.endpoint) {
    clientConfig.endpoint = config.endpoint;
    clientConfig.forcePathStyle = config.forcePathStyle || false;
  }

  return new S3Client(clientConfig);
};

// 生成文件路径
const generateFilePath = (file: Express.Multer.File, configService: ConfigService): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);

  // 获取文件扩展名
  const ext = path.extname(file.originalname);
  const nameWithoutExt = path.basename(file.originalname, ext);

  // 生成安全的文件名
  const safeName = nameWithoutExt.replace(/[^a-zA-Z0-9]/g, '_');

  return `${configService.get('MULTER_DEST', 'uploads')}/${year}/${month}/${day}/${timestamp}-${randomSuffix}-${safeName}${ext}`;
};

const getAllowedMimeTypes = (configService: ConfigService): string[] => {
  const rawMimeTypes = configService.get<string>('UPLOAD_ALLOWED_MIME_TYPES');
  if (!rawMimeTypes) {
    return DEFAULT_ALLOWED_MIME_TYPES;
  }

  return rawMimeTypes
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const getMaxFileSize = (configService: ConfigService): number => {
  const configured = Number(configService.get('UPLOAD_MAX_FILE_SIZE'));
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MAX_FILE_SIZE;
};

const getMaxFileCount = (configService: ConfigService): number => {
  const configured = Number(configService.get('UPLOAD_MAX_FILE_COUNT'));
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MAX_FILE_COUNT;
};

const buildCommonOptions = (
  configService: ConfigService,
): Pick<MulterOptions, 'fileFilter' | 'limits'> => {
  const allowedMimeTypes = new Set(getAllowedMimeTypes(configService));

  return {
    fileFilter: (req, file, cb) => {
      if (!allowedMimeTypes.has(file.mimetype)) {
        cb(new BadRequestException(`Unsupported file type: ${file.mimetype}`), false);
        return;
      }

      cb(null, true);
    },
    limits: {
      fileSize: getMaxFileSize(configService),
      files: getMaxFileCount(configService),
    },
  };
};

export const multerConfig = (configService: ConfigService): MulterOptions => {
  const storageType = configService.get('MULTER_STORAGE', 'local');
  const commonOptions = buildCommonOptions(configService);
  // S3存储配置
  if (storageType === 's3') {
    const s3Config: S3Config = {
      region: configService.get('AWS_REGION') || 'us-east-1',
      accessKeyId: configService.get('AWS_ACCESS_KEY_ID') || '',
      secretAccessKey: configService.get('AWS_SECRET_ACCESS_KEY') || '',
      bucket: configService.get('AWS_BUCKET') || '',
      endpoint: configService.get('AWS_ENDPOINT'),
      forcePathStyle: configService.get('AWS_FORCE_PATH_STYLE') === 'true',
      cdnDomain: configService.get('AWS_CDN_DOMAIN'),
    };
    // 验证必要的S3配置
    if (!s3Config.accessKeyId || !s3Config.secretAccessKey || !s3Config.bucket) {
      const errorMsg =
        'S3配置不完整，请检查AWS_ACCESS_KEY_ID、AWS_SECRET_ACCESS_KEY和AWS_BUCKET配置';
      throw new Error(errorMsg);
    }

    const s3Client = createS3Client(s3Config);

    return {
      ...commonOptions,
      storage: multerS3({
        s3: s3Client,
        bucket: s3Config.bucket,
        acl: 'public-read',
        cacheControl: 'max-age=31536000, public',
        contentType: multerS3.AUTO_CONTENT_TYPE,

        metadata: (req: any, file, cb) => {
          const metadata = {
            originalName: file.originalname,
            filename: file.filename,
            uploadedAt: new Date().toISOString(),
            cdnUrl: `${configService.get('AWS_CDN_DOMAIN')}/`,
          };
          cb(null, metadata);
        },

        key: (req, file, cb) => {
          const filePath = generateFilePath(file, configService);
          cb(null, filePath);
        },
      }),

      // 错误处理
      preservePath: false,
    };
  } else {
    // 本地存储配置
    const baseUploadPath = path.join(
      __dirname,
      '..',
      '..',
      configService.get('MULTER_DEST', 'uploads'),
    );

    // 确保基础目录存在
    if (!fs.existsSync(baseUploadPath)) {
      fs.mkdirSync(baseUploadPath, { recursive: true });
    }

    return {
      ...commonOptions,
      storage: diskStorage({
        destination: (req, file, cb) => {
          // 按年月日创建子目录
          const now = new Date();
          const year = now.getFullYear();
          const month = String(now.getMonth() + 1).padStart(2, '0');
          const day = String(now.getDate()).padStart(2, '0');
          const uploadPath = path.join(baseUploadPath, String(year), month, day);
          // 确保目录存在
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }

          cb(null, uploadPath);
        },

        filename: (req, file, cb) => {
          const timestamp = Date.now();
          const randomSuffix = Math.random().toString(36).substring(2, 8);
          const ext = path.extname(file.originalname);
          const nameWithoutExt = path.basename(file.originalname, ext);
          const safeName = nameWithoutExt.replace(/[^a-zA-Z0-9]/g, '_');

          const filename = `${timestamp}-${randomSuffix}-${safeName}${ext}`;

          cb(null, filename);
        },
      }),
    };
  }
};
