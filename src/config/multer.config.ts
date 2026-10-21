import { BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MulterOptions } from "@nestjs/platform-express/multer/interfaces/multer-options.interface";
import { diskStorage } from "multer";
import * as path from "path";
import * as fs from "fs";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const multerS3 = require("multer-s3");
import { S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { UPLOAD_ALLOWED_MIME_TYPES } from "../common/constants/media.constants";
import {
  createS3Client,
  resolveS3ConnectionOptions,
} from "../common/s3/s3-client.factory";
import {
  resolveAllowedMimeTypes,
  resolveGatewayMaxSizeBytes,
  resolveGlobalMaxFileSizeBytes,
  resolveMaxFileCount,
} from "../common/utils/upload-limit.util";

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

const buildCommonOptions = (
  configService: ConfigService,
): Pick<MulterOptions, "fileFilter" | "limits"> => {
  const allowedMimeTypes = new Set(
    resolveAllowedMimeTypes(configService, UPLOAD_ALLOWED_MIME_TYPES),
  );

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
      const contentLength = req.headers["content-length"];
      if (contentLength) {
        const fileSize = parseInt(contentLength as string, 10);
        const maxSize = resolveGatewayMaxSizeBytes(
          configService,
          file.mimetype,
        );

        if (fileSize > maxSize) {
          const maxSizeMB = (maxSize / 1024 / 1024).toFixed(1);
          const fileSizeMB = (fileSize / 1024 / 1024).toFixed(1);
          cb(
            new BadRequestException(
              `文件大小超过限制: ${fileSizeMB}MB > ${maxSizeMB}MB (${file.mimetype.startsWith("image/") ? "图片" : file.mimetype.startsWith("video/") ? "视频" : "文件"}最大限制)`,
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
      fileSize: resolveGlobalMaxFileSizeBytes(configService),
      files: resolveMaxFileCount(configService),
    },
  };
};

export const multerConfig = (configService: ConfigService): MulterOptions => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const storageType = configService.get("MULTER_STORAGE", "local");
  const commonOptions = buildCommonOptions(configService);
  // S3存储配置
  if (storageType === "s3") {
    const s3Config = resolveS3ConnectionOptions(configService);
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

    const s3Client: S3Client = createS3Client(s3Config);

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
          const originalName = Buffer.from(
            file.originalname,
            "latin1",
          ).toString("utf8");
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
          file.originalname = Buffer.from(file.originalname, "latin1").toString(
            "utf8",
          );
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
          const originalName = Buffer.from(
            file.originalname,
            "latin1",
          ).toString("utf8");
          // 将修复后的原始文件名设置回 file 对象，供后续使用
          file.originalname = originalName;
          const uniqueFilename = generateUniqueFilename(file);
          cb(null, uniqueFilename);
        },
      }),
    };
  }
};
