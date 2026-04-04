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
} from "@nestjs/common";
import { AnyFilesInterceptor } from "@nestjs/platform-express";
import { UploadService } from "./upload.service";
import { UploadMigrationService } from "./upload-migration.service";
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
    return {
      // 前端预压缩建议配置
      compression: {
        // 建议前端预压缩的最大宽度
        maxWidth: this.configService.get<number>("upload.clientHint.maxWidth"),
        // 建议前端预压缩质量（后端会重新处理，前端可稍低）
        quality: this.configService.get<number>("upload.clientHint.quality"),
        // 建议前端输出格式
        format: this.configService.get<string>("upload.clientHint.format"),
      },
      // 文件限制
      limits: {
        // 最大文件大小（字节）
        maxFileSize:
          this.configService.get<number>("UPLOAD_MAX_FILE_SIZE") ||
          10 * 1024 * 1024,
        // 单次最大文件数
        maxFileCount:
          this.configService.get<number>("UPLOAD_MAX_FILE_COUNT") || 10,
      },
      // 支持的 MIME 类型（包含苹果 HEIC/HEIF 格式）
      allowedMimeTypes: [
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "image/heic",
        "image/heif",
      ],
    };
  }
  @ApiOperation({ summary: "上传文件" })
  @ApiBody({ type: Array<Express.Multer.File> })
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
    return await this.uploadService.uploadFile(files, req);
  }

  /**
   * 获取文件信息
   */
  @ApiOperation({ summary: "获取文件信息" })
  @ApiResponse({ status: 200, description: "获取文件信息成功", type: Upload })
  @ApiResponse({ status: 404, description: "文件不存在" })
  @ApiParam({ name: "id", description: "文件ID" })
  @Get("info/:id")
  async getFileInfo(@Param("id") id: string) {
    return await this.uploadService.getFileInfo(+id);
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
