import { BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MulterOptions } from "@nestjs/platform-express/multer/interfaces/multer-options.interface";
import { diskStorage } from "multer";
import * as path from "path";
import * as fs from "fs";
import multerS3 from "multer-s3";
import { S3Client, S3ClientConfig } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";

// 图片 MIME 类型
const IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/tiff",
  "image/avif",
  "image/bmp",
];

// 视频 MIME 类型
const VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",
  "video/avi",
  "video/mpeg",
  "video/flv",
  "video/x-flv",
  "video/x-m4v",
  "video/3gpp",
];

// 音频 MIME 类型
const AUDIO_MIME_TYPES = [
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/aac",
  "audio/flac",
  "audio/x-m4a",
];

const DEFAULT_ALLOWED_MIME_TYPES = [
  ...IMAGE_MIME_TYPES,
  ...VIDEO_MIME_TYPES,
  ...AUDIO_MIME_TYPES,
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "application/vnd.rar",
  "application/x-rar-compressed",
  "application/x-7z-compressed",
];

// 默认大小限制（向后兼容）
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024;

// 图片默认限制：20MB
const DEFAULT_MAX_IMAGE_SIZE = 20 * 1024 * 1024;

// 视频默认限制：500MB
const DEFAULT_MAX_VIDEO_SIZE = 500 * 1024 * 1024;

// 音频默认限制：50MB
const DEFAULT_MAX_AUDIO_SIZE = 50 * 1024 * 1024;

// 其他文件默认限制：100MB
const DEFAULT_MAX_OTHER_SIZE = 100 * 1024 * 1024;

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
const generateFilePath = (
  file: Express.Multer.File,
  configService: ConfigService,
): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  // 生成唯一文件名
  const uniqueFilename = generateUniqueFilename(file);

  return `${configService.get("MULTER_DEST", "uploads")}/${year}/${month}/${day}/${uniqueFilename}`;
};

/**
 * 生成唯一的文件名
 * 格式: {uuid}.{ext}
 * 使用UUID v4生成唯一标识符，确保文件名唯一且URL安全
 */
const generateUniqueFilename = (file: Express.Multer.File): string => {
  const ext = path.extname(file.originalname).toLowerCase();
  const uuid = randomUUID();
  return `${uuid}${ext}`;
};

const getAllowedMimeTypes = (configService: ConfigService): string[] => {
  const rawMimeTypes = configService.get<string>("UPLOAD_ALLOWED_MIME_TYPES");
  if (!rawMimeTypes) {
    return DEFAULT_ALLOWED_MIME_TYPES;
  }

  return rawMimeTypes
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

/**
 * 将 MB 转换为字节
 */
const mbToBytes = (mb: number): number => mb * 1024 * 1024;

/**
 * 获取文件类型对应的最大大小限制（从配置读取 MB，返回字节）
 */
const getMaxFileSizeByType = (
  configService: ConfigService,
  mimeType: string,
): number => {
  // 图片类型
  if (IMAGE_MIME_TYPES.some(type => mimeType.toLowerCase().startsWith(type.replace('/*', '')))) {
    const configuredMB = Number(configService.get("UPLOAD_MAX_IMAGE_SIZE"));
    if (Number.isFinite(configuredMB) && configuredMB > 0) {
      return mbToBytes(configuredMB);
    }
    // 向后兼容：如果没有设置图片专用限制，使用旧的通用限制（字节）
    const legacyConfigured = Number(configService.get("UPLOAD_MAX_FILE_SIZE"));
    if (Number.isFinite(legacyConfigured) && legacyConfigured > 0) {
      return legacyConfigured;
    }
    return DEFAULT_MAX_IMAGE_SIZE;
  }

  // 视频类型
  if (VIDEO_MIME_TYPES.some(type => mimeType.toLowerCase().startsWith(type.replace('/*', '')))) {
    const configuredMB = Number(configService.get("UPLOAD_MAX_VIDEO_SIZE"));
    if (Number.isFinite(configuredMB) && configuredMB > 0) {
      return mbToBytes(configuredMB);
    }
    // 向后兼容：如果没有设置视频专用限制，使用旧的通用限制（字节）
    const legacyConfigured = Number(configService.get("UPLOAD_MAX_FILE_SIZE"));
    if (Number.isFinite(legacyConfigured) && legacyConfigured > 0) {
      return legacyConfigured;
    }
    return DEFAULT_MAX_VIDEO_SIZE;
  }

  // 音频类型
  if (AUDIO_MIME_TYPES.some(type => mimeType.toLowerCase().startsWith(type.replace('/*', '')))) {
    const configuredMB = Number(configService.get("UPLOAD_MAX_AUDIO_SIZE"));
    if (Number.isFinite(configuredMB) && configuredMB > 0) {
      return mbToBytes(configuredMB);
    }
    return DEFAULT_MAX_AUDIO_SIZE;
  }

  // 其他类型
  const configuredMB = Number(configService.get("UPLOAD_MAX_OTHER_SIZE"));
  if (Number.isFinite(configuredMB) && configuredMB > 0) {
    return mbToBytes(configuredMB);
  }
  return DEFAULT_MAX_OTHER_SIZE;
};

/**
 * 获取全局最大文件大小限制（作为安全上限）
 * 取所有类型限制中的最大值
 */
const getGlobalMaxFileSize = (configService: ConfigService): number => {
  const imageSizeMB = Number(configService.get("UPLOAD_MAX_IMAGE_SIZE")) || 0;
  const videoSizeMB = Number(configService.get("UPLOAD_MAX_VIDEO_SIZE")) || 0;
  const audioSizeMB = Number(configService.get("UPLOAD_MAX_AUDIO_SIZE")) || 0;
  const otherSizeMB = Number(configService.get("UPLOAD_MAX_OTHER_SIZE")) || 0;
  const legacySize = Number(configService.get("UPLOAD_MAX_FILE_SIZE"));

  // 将 MB 转换为字节
  const imageSize = imageSizeMB > 0 ? mbToBytes(imageSizeMB) : DEFAULT_MAX_IMAGE_SIZE;
  const videoSize = videoSizeMB > 0 ? mbToBytes(videoSizeMB) : DEFAULT_MAX_VIDEO_SIZE;
  const audioSize = audioSizeMB > 0 ? mbToBytes(audioSizeMB) : DEFAULT_MAX_AUDIO_SIZE;
  const otherSize = otherSizeMB > 0 ? mbToBytes(otherSizeMB) : DEFAULT_MAX_OTHER_SIZE;

  const maxSize = Math.max(imageSize, videoSize, audioSize, otherSize);

  // 如果配置了旧的限制且比新的限制大，使用旧的限制（向后兼容）
  if (Number.isFinite(legacySize) && legacySize > maxSize) {
    return legacySize;
  }

  return maxSize;
};

const getMaxFileCount = (configService: ConfigService): number => {
  const configured = Number(configService.get("UPLOAD_MAX_FILE_COUNT"));
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_MAX_FILE_COUNT;
};

const buildCommonOptions = (
  configService: ConfigService,
): Pick<MulterOptions, "fileFilter" | "limits"> => {
  const allowedMimeTypes = new Set(getAllowedMimeTypes(configService));

  return {
    fileFilter: (req, file, cb) => {
      if (!allowedMimeTypes.has(file.mimetype)) {
        cb(
          new BadRequestException(`不支持的文件类型: ${file.mimetype}`),
          false,
        );
        return;
      }

      // 检查文件大小限制
      const contentLength = req.headers['content-length'];
      if (contentLength) {
        const fileSize = parseInt(contentLength as string, 10);
        const maxSize = getMaxFileSizeByType(configService, file.mimetype);

        if (fileSize > maxSize) {
          const maxSizeMB = (maxSize / 1024 / 1024).toFixed(1);
          const fileSizeMB = (fileSize / 1024 / 1024).toFixed(1);
          cb(
            new BadRequestException(
              `文件大小超过限制: ${fileSizeMB}MB > ${maxSizeMB}MB (${file.mimetype.startsWith('image/') ? '图片' : file.mimetype.startsWith('video/') ? '视频' : '文件'}最大限制)`
            ),
            false,
          );
          return;
        }
      }

      cb(null, true);
    },
    limits: {
      // 使用全局最大限制作为硬限制
      fileSize: getGlobalMaxFileSize(configService),
      files: getMaxFileCount(configService),
    },
  };
};

export const multerConfig = (configService: ConfigService): MulterOptions => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const storageType = configService.get("MULTER_STORAGE", "local");
  const commonOptions = buildCommonOptions(configService);
  // S3存储配置
  if (storageType === "s3") {
    const s3Config: S3Config = {
      region: configService.get("AWS_REGION") || "us-east-1",
      accessKeyId: configService.get("AWS_ACCESS_KEY_ID") || "",
      secretAccessKey: configService.get("AWS_SECRET_ACCESS_KEY") || "",
      bucket: configService.get("AWS_BUCKET") || "",
      endpoint: configService.get("AWS_ENDPOINT"),
      forcePathStyle: configService.get("AWS_FORCE_PATH_STYLE") === "true",
      cdnDomain: configService.get("AWS_CDN_DOMAIN"),
    };
    // 验证必要的S3配置
    if (
      !s3Config.accessKeyId ||
      !s3Config.secretAccessKey ||
      !s3Config.bucket
    ) {
      const errorMsg =
        "S3配置不完整，请检查AWS_ACCESS_KEY_ID、AWS_SECRET_ACCESS_KEY和AWS_BUCKET配置";
      throw new Error(errorMsg);
    }

    const s3Client = createS3Client(s3Config);

    return {
      ...commonOptions,
      storage: multerS3({
        s3: s3Client,
        bucket: s3Config.bucket,
        acl: "public-read",
        cacheControl: "max-age=31536000, public",
        // eslint-disable-next-line @typescript-eslint/unbound-method
        contentType: multerS3.AUTO_CONTENT_TYPE,

        metadata: (_req, file, cb) => {
          // 修复中文文件名乱码问题
          const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
          const metadata = {
            originalName: originalName,
            filename: file.filename,
            uploadedAt: new Date().toISOString(),
            cdnUrl: `${configService.get("AWS_CDN_DOMAIN")}/`,
          };
          cb(null, metadata);
        },

        key: (_req, file, cb) => {
          // 修复中文文件名乱码问题
          file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
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
      "..",
      "..",
      configService.get("MULTER_DEST", "uploads"),
    );

    // 确保基础目录存在
    if (!fs.existsSync(baseUploadPath)) {
      fs.mkdirSync(baseUploadPath, { recursive: true });
    }

    return {
      ...commonOptions,
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          // 按年月日创建子目录
          const now = new Date();
          const year = now.getFullYear();
          const month = String(now.getMonth() + 1).padStart(2, "0");
          const day = String(now.getDate()).padStart(2, "0");
          const uploadPath = path.join(
            baseUploadPath,
            String(year),
            month,
            day,
          );
          // 确保目录存在
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }

          cb(null, uploadPath);
        },

        filename: (_req, file, cb) => {
          // 修复中文文件名乱码问题
          // multer 默认使用 latin1 编码，需要转换为 utf-8
          const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
          // 将修复后的原始文件名设置回 file 对象，供后续使用
          file.originalname = originalName;
          const uniqueFilename = generateUniqueFilename(file);
          cb(null, uniqueFilename);
        },
      }),
    };
  }
};
