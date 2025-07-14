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
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import {
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Upload } from './entities/upload.entity';
import { AuthGuard } from '@nestjs/passport';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { PermissionGuard } from 'src/common/guards/permission.guard';
import { PaginationDto } from 'src/common/dto/pagination.dto';

@ApiTags('上传管理')
@ApiBearerAuth()
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  /**
   * 上传文件
   */
  @ApiOperation({ summary: '上传文件' })
  @ApiBody({ type: Array<Express.Multer.File> })
  @ApiResponse({ status: 200, description: '上传文件成功', type: [Upload] })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 403, description: '权限不足' })
  @ApiResponse({ status: 500, description: '服务器错误' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('upload:create')
  @Post('file')
  @UseInterceptors(AnyFilesInterceptor())
  async uploadFile(@UploadedFiles() files: Array<Express.Multer.File>, @Req() req: Request) {
    return await this.uploadService.uploadFile(files, req);
  }

  /**
   * 获取文件信息
   */
  @ApiOperation({ summary: '获取文件信息' })
  @ApiResponse({ status: 200, description: '获取文件信息成功', type: Upload })
  @ApiResponse({ status: 404, description: '文件不存在' })
  @ApiParam({ name: 'id', description: '文件ID' })
  @Get('info/:id')
  async getFileInfo(@Param('id') id: string) {
    return await this.uploadService.getFileInfo(+id);
  }

  /**
   * 获取所有上传文件
   */
  @Get()
  @ApiOperation({ summary: '获取所有上传文件' })
  @ApiResponse({ status: 200, description: '获取所有上传文件成功', type: [Upload] })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('upload:list')
  async findAll(@Query() pagination: PaginationDto) {
    return await this.uploadService.findAll(pagination);
  }

  /**
   * 删除文件
   */
  @ApiOperation({ summary: '删除文件' })
  @ApiResponse({ status: 200, description: '删除文件成功' })
  @ApiResponse({ status: 400, description: '删除文件失败' })
  @ApiResponse({ status: 403, description: '未授权' })
  @ApiResponse({ status: 500, description: '服务器错误' })
  @ApiResponse({ status: 404, description: '文件不存在' })
  @ApiParam({ name: 'id', description: '文件ID' })
  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('upload:delete')
  async remove(@Param('id') id: string) {
    return await this.uploadService.remove(+id);
  }
}
