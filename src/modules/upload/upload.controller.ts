import {
  Controller,
  Get,
  Post,
  Param,
  Delete,
  UseInterceptors,
  UseGuards,
  Query,
  UploadedFiles,
  Req,
  BadRequestException,
  Body,
} from "@nestjs/common";
import { AnyFilesInterceptor } from "@nestjs/platform-express";
import { UploadService } from "./upload.service";
import { UploadMigrationService } from "./upload-migration.service";
import { S3PresignService } from "./s3-presign.service";
import { PresignedUrlDto } from "./dto/presigned-url.dto";
import {
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import { Upload } from "./entities/upload.entity";
import { AuthGuard } from "@nestjs/passport";
import { Permissions } from "src/common/decorators/permissions.decorator";
import { PermissionGuard } from "src/common/guards/permission.guard";
import { PaginationDto } from "src/common/dto/pagination.dto";
import { Request } from "express";
import { ConfigService } from "@nestjs/config";
import { NoAuth } from "src/common/decorators/no-auth.decorator";

@ApiTags("上传管理")
@ApiBearerAuth()
@Controller("upload")
export class UploadController {
  constructor(
    private readonly uploadService: UploadService,
    private readonly migrationService: UploadMigrationService,
    private readonly configService: ConfigService,
    private readonly s3PresignService: S3PresignService,
  ) {}

  /**
   * 获取上传配置（供前端预压缩使用）
   * 返回建议的前端压缩参数，确保前后端配置一致
   */
  @ApiOperation({ summary: "获取上传配置" })
  @ApiResponse({ status: 200, description: "获取成功" })
  @Get("config")
  @NoAuth()
  getUploadConfig() {
    // 存储类型
    const storageType = this.configService.get("MULTER_STORAGE", "local");

    // 各类型文件大小限制（MB）
    const sizeLimits = {
      image: this.configService.get<number>("UPLOAD_MAX_IMAGE_SIZE", 20),
      video: this.configService.get<number>("UPLOAD_MAX_VIDEO_SIZE", 500),
      audio: this.configService.get<number>("UPLOAD_MAX_AUDIO_SIZE", 50),
      other: this.configService.get<number>("UPLOAD_MAX_OTHER_SIZE", 100),
    };

    // 转换为字节供前端使用
    const mbToBytes = (mb: number) => mb * 1024 * 1024;

    return {
      // 存储配置
      storage: {
        type: storageType,
        // S3 配置（仅当使用 S3 时有效）
        s3: storageType === "s3" ? {
          region: this.configService.get("AWS_REGION", "us-east-1"),
          bucket: this.configService.get("AWS_BUCKET"),
          endpoint: this.configService.get("AWS_ENDPOINT"),
          cdnDomain: this.configService.get("AWS_CDN_DOMAIN"),
          forcePathStyle: this.configService.get("AWS_FORCE_PATH_STYLE") === "true",
        } : undefined,
      },

      // 前端预压缩建议配置
      compression: {
        // 图片压缩建议
        image: {
          // 建议前端预压缩的最大宽度
          maxWidth: this.configService.get<number>("upload.clientHint.maxWidth", 1920),
          // 建议前端预压缩质量（后端会重新处理，前端可稍低）
          quality: this.configService.get<number>("upload.clientHint.quality", 75),
          // 建议前端输出格式
          format: this.configService.get<string>("upload.clientHint.format", "webp"),
        },
        // 视频压缩建议
        video: {
          // 是否启用视频压缩
          enabled: this.configService.get<boolean>("upload.videoCompression.enabled", true),
          // 建议前端预压缩的最大宽度
          maxWidth: this.configService.get<number>("upload.videoCompression.maxWidth", 1920),
          maxHeight: this.configService.get<number>("upload.videoCompression.maxHeight", 1080),
          // 建议前端预压缩质量（CRF值，0-51，默认23）
          crf: this.configService.get<number>("upload.videoCompression.crf", 23),
        },
      },

      // 文件限制
      limits: {
        // 各类型文件大小限制
        maxSize: {
          image: {
            mb: sizeLimits.image,
            bytes: mbToBytes(sizeLimits.image),
          },
          video: {
            mb: sizeLimits.video,
            bytes: mbToBytes(sizeLimits.video),
          },
          audio: {
            mb: sizeLimits.audio,
            bytes: mbToBytes(sizeLimits.audio),
          },
          other: {
            mb: sizeLimits.other,
            bytes: mbToBytes(sizeLimits.other),
          },
        },
        // 单次最大文件数
        maxFileCount: this.configService.get<number>("UPLOAD_MAX_FILE_COUNT", 10),
      },

      // 支持的 MIME 类型
      allowedMimeTypes: {
        image: [
          "image/jpeg",
          "image/png",
          "image/gif",
          "image/webp",
          "image/heic",
          "image/heif",
          "image/tiff",
          "image/avif",
          "image/bmp",
        ],
        video: [
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
        ],
        audio: [
          "audio/mpeg",
          "audio/wav",
          "audio/ogg",
          "audio/aac",
          "audio/flac",
          "audio/x-m4a",
        ],
        document: [
          "application/pdf",
          "application/zip",
          "application/x-zip-compressed",
          "application/vnd.rar",
          "application/x-rar-compressed",
          "application/x-7z-compressed",
        ],
      },

      // 图片处理配置
      imageProcessing: {
        // 后端是否启用压缩
        compressionEnabled: this.configService.get<boolean>("upload.compression.enabled", true),
        // 压缩输出格式
        format: this.configService.get<string>("upload.compression.format", "webp"),
        // 压缩质量
        quality: this.configService.get<number>("upload.compression.quality", 85),
        // 最大分辨率限制
        maxWidth: this.configService.get<number>("upload.compression.maxWidth", 3840),
        maxHeight: this.configService.get<number>("upload.compression.maxHeight", 2160),
        // 是否保留原图
        keepOriginal: this.configService.get<boolean>("upload.compression.keepOriginal", true),
      },

      // 视频处理配置
      videoProcessing: {
        // 是否启用压缩
        compressionEnabled: this.configService.get<boolean>("upload.videoCompression.enabled", true),
        // 编码预设
        preset: this.configService.get<string>("upload.videoCompression.preset", "medium"),
        // 编码质量（CRF）
        crf: this.configService.get<number>("upload.videoCompression.crf", 23),
        // 最大分辨率
        maxWidth: this.configService.get<number>("upload.videoCompression.maxWidth", 1920),
        maxHeight: this.configService.get<number>("upload.videoCompression.maxHeight", 1080),
        // 码率限制
        videoBitrate: this.configService.get<string>("upload.videoCompression.videoBitrate", "5000k"),
        audioBitrate: this.configService.get<string>("upload.videoCompression.audioBitrate", "128k"),
        // 最小压缩文件大小（MB）
        minCompressSize: this.configService.get<number>("upload.videoCompression.minFileSize", 10) / (1024 * 1024),
      },
    };
  }
  
  @ApiOperation({ summary: "上传文件" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        files: { type: "array", items: { type: "string", format: "binary" } },
        metadata: {
          type: "string",
          description: "文件元数据JSON数组字符串，如：[{hash: 'sha256...', name: '...'}, ...]",
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: "上传文件成功", type: [Upload] })
  @ApiResponse({ status: 400, description: "请求参数错误" })
  @ApiResponse({ status: 403, description: "权限不足" })
  @ApiResponse({ status: 500, description: "服务器错误" })
  @ApiBearerAuth()
  @UseGuards(AuthGuard("jwt"), PermissionGuard)
  @Permissions("upload:create")
  @Post("file")
  @UseInterceptors(AnyFilesInterceptor())
  async uploadFile(
    @UploadedFiles() files: Array<Express.Multer.File>,
    @Req() req: Request,
  ) {
    // 从 formData body 解析 metadata JSON
    const metadataJson = (req.body?.metadata as string) || (req.body?.metadata as string);
    let metadata: Array<{ hash?: string; name?: string }> = [];
    if (metadataJson) {
      try {
        metadata = JSON.parse(metadataJson);
        if (!Array.isArray(metadata)) {
          metadata = [metadata];
        }
      } catch {
        throw new BadRequestException("metadata must be a valid JSON array");
      }
    }
    return await this.uploadService.uploadFile(files, req, metadata);
  }

  /**
   * 获取文件信息
   */
  @ApiOperation({ summary: "获取文件信息" })
  @ApiResponse({ status: 200, description: "获取文件信息成功", type: Upload })
  @ApiResponse({ status: 404, description: "文件不存在" })
  @ApiParam({ name: "id", description: "文件ID" })
  @Get("info/:id")
  async getFileInfo(@Param("id") id: string, @Req() req: Request) {
    return await this.uploadService.getFileInfo(+id, req);
  }

  /**
   * 生成 S3 预签名上传 URL（直传）
   * 适用于大文件上传场景，前端可直接上传到 S3，不经过后端
   */
  @ApiOperation({ summary: "获取 S3 预签名上传 URL（直传）" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        filename: { type: "string", description: "文件名" },
        contentType: { type: "string", description: "MIME 类型" },
        size: { type: "number", description: "文件大小（字节）" },
      },
      required: ["filename", "contentType", "size"],
    },
  })
  @ApiResponse({ status: 200, description: "获取成功" })
  @ApiResponse({ status: 400, description: "参数错误或文件类型/大小不支持" })
  @ApiBearerAuth()
  @UseGuards(AuthGuard("jwt"), PermissionGuard)
  @Permissions("upload:create")
  @Post("presign")
  async generatePresignedUrl(@Body() dto: PresignedUrlDto) {
    return await this.s3PresignService.generatePresignedUrl(dto);
  }

  /**
   * 确认 S3 直传完成，创建数据库记录
   * 前端上传完成后调用此接口通知后端
   */
  @ApiOperation({ summary: "确认 S3 直传完成" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        key: { type: "string", description: "S3 Key" },
        url: { type: "string", description: "文件访问 URL" },
        originalName: { type: "string", description: "原始文件名" },
        mimeType: { type: "string", description: "MIME 类型" },
        size: { type: "number", description: "文件大小（字节）" },
        hash: { type: "string", description: "文件哈希（可选）" },
      },
      required: ["key", "url", "originalName", "mimeType", "size"],
    },
  })
  @ApiResponse({ status: 200, description: "创建成功", type: Upload })
  @ApiResponse({ status: 400, description: "参数错误" })
  @ApiBearerAuth()
  @UseGuards(AuthGuard("jwt"), PermissionGuard)
  @Permissions("upload:create")
  @Post("confirm")
  async confirmUpload(
    @Body() data: {
      key: string;
      url: string;
      originalName: string;
      mimeType: string;
      size: number;
      hash?: string;
    },
    @Req() req: Request,
  ) {
    return await this.uploadService.confirmS3Upload(data, req);
  }

  /**
   * 获取所有上传文件
   */
  @Get()
  @ApiOperation({ summary: "获取所有上传文件" })
  @ApiResponse({
    status: 200,
    description: "获取所有上传文件成功",
    type: [Upload],
  })
  @ApiBearerAuth()
  @UseGuards(AuthGuard("jwt"), PermissionGuard)
  @Permissions("upload:list")
  async findAll(
    @Query() pagination: PaginationDto,
    @Query("sortBy") sortBy?: string,
    @Query("sortOrder") sortOrder?: "ASC" | "DESC",
  ) {
    return await this.uploadService.findAll(pagination, sortBy, sortOrder);
  }

  /**
   * 获取压缩处理统计
   */
  @ApiOperation({ summary: "获取压缩处理统计（管理员）" })
  @ApiResponse({ status: 200, description: "获取成功" })
  @ApiBearerAuth()
  @UseGuards(AuthGuard("jwt"), PermissionGuard)
  @Permissions("upload:manage")
  @Get("migration/stats")
  async getMigrationStats() {
    return await this.migrationService.getProcessingStats();
  }

  /**
   * 批量处理未压缩的图片
   */
  @ApiOperation({ summary: "批量处理未压缩图片（管理员）" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "处理数量限制", default: 100 },
        dryRun: {
          type: "boolean",
          description: "模拟运行（不实际处理）",
          default: false,
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: "处理完成" })
  @ApiBearerAuth()
  @UseGuards(AuthGuard("jwt"), PermissionGuard)
  @Permissions("upload:manage")
  @Post("migration/process")
  async processUncompressedImages(
    @Query("limit") limit?: string,
    @Query("dryRun") dryRun?: string,
  ) {
    return await this.migrationService.processUncompressedImages({
      limit: limit ? parseInt(limit, 10) : 100,
      dryRun: dryRun === "true",
    });
  }

  /**
   * 补充缺失的元数据
   */
  @ApiOperation({ summary: "补充图片元数据（管理员）" })
  @ApiResponse({ status: 200, description: "处理完成" })
  @ApiBearerAuth()
  @UseGuards(AuthGuard("jwt"), PermissionGuard)
  @Permissions("upload:manage")
  @Post("migration/metadata")
  async fillMissingMetadata(@Query("limit") limit?: string) {
    return await this.migrationService.fillMissingMetadata(
      limit ? parseInt(limit, 10) : 100,
    );
  }
}
