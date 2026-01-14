import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Patch,
  Query,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { EmojiService } from './emoji.service';
import { CreateEmojiDto } from './dto/create-emoji.dto';
import { UpdateEmojiDto } from './dto/update-emoji.dto';
import { QueryEmojiDto } from './dto/query-emoji.dto';
import { UploadEmojiDto } from './dto/upload-emoji.dto';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiParam,
  ApiBearerAuth,
  ApiConsumes,
  ApiQuery,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { PermissionGuard } from 'src/common/guards/permission.guard';
import { PaginationDto } from 'src/common/dto/pagination.dto';

@ApiTags('表情包管理')
@Controller('emoji')
export class EmojiController {
  constructor(private readonly emojiService: EmojiService) {}

  @ApiOperation({ summary: '创建表情' })
  @ApiBody({ type: CreateEmojiDto })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post()
  async create(@Body() createEmojiDto: CreateEmojiDto, @Req() req: any) {
    return this.emojiService.create(createEmojiDto, req.user);
  }

  @ApiOperation({ summary: '上传表情图片' })
  @ApiConsumes('multipart/form-data')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() uploadEmojiDto: UploadEmojiDto,
    @Req() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('response.error.fileRequired');
    }

    // 验证文件类型
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('response.error.invalidFileType');
    }

    // 验证文件大小（最大 5MB）
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException('response.error.fileTooLarge');
    }

    // 这里应该调用上传服务将文件上传到存储服务
    // 暂时使用本地路径
    const url = `/uploads/emoji/${file.filename}`;

    const createEmojiDto: CreateEmojiDto = {
      name: uploadEmojiDto.name,
      url,
      code: uploadEmojiDto.code,
      category: uploadEmojiDto.category,
      tags: uploadEmojiDto.tags,
      isPublic: uploadEmojiDto.isPublic,
      type: 'user',
      fileSize: file.size,
      mimeType: file.mimetype,
    };

    return this.emojiService.create(createEmojiDto, req.user);
  }

  @ApiOperation({ summary: '获取表情列表' })
  @ApiQuery({ name: 'type', enum: ['system', 'user'], required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'keyword', required: false })
  @ApiQuery({ name: 'isPublic', type: Boolean, required: false })
  @ApiQuery({ name: 'onlyFavorites', type: Boolean, required: false })
  @Get()
  async findAll(@Query() queryDto: QueryEmojiDto, @Req() req: any) {
    return this.emojiService.findAll(queryDto, req.user);
  }

  @ApiOperation({ summary: '获取单个表情' })
  @ApiParam({ name: 'id', description: '表情ID' })
  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    return this.emojiService.findOne(+id, req.user);
  }

  @ApiOperation({ summary: '更新表情' })
  @ApiParam({ name: 'id', description: '表情ID' })
  @ApiBody({ type: UpdateEmojiDto })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateEmojiDto: UpdateEmojiDto,
    @Req() req: any,
  ) {
    return this.emojiService.update(+id, updateEmojiDto, req.user);
  }

  @ApiOperation({ summary: '删除表情' })
  @ApiParam({ name: 'id', description: '表情ID' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    return this.emojiService.remove(+id, req.user);
  }

  @ApiOperation({ summary: '添加到收藏' })
  @ApiParam({ name: 'id', description: '表情ID' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post(':id/favorite')
  async addToFavorites(@Param('id') id: string, @Req() req: any) {
    return this.emojiService.addToFavorites(+id, req.user);
  }

  @ApiOperation({ summary: '取消收藏' })
  @ApiParam({ name: 'id', description: '表情ID' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Delete(':id/favorite')
  async removeFromFavorites(@Param('id') id: string, @Req() req: any) {
    return this.emojiService.removeFromFavorites(+id, req.user);
  }

  @ApiOperation({ summary: '获取我的收藏' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('favorites/list')
  async getFavorites(@Query() pagination: PaginationDto, @Req() req: any) {
    return this.emojiService.getFavorites(
      req.user,
      pagination.page,
      pagination.limit,
    );
  }

  @ApiOperation({ summary: '增加使用次数' })
  @ApiParam({ name: 'id', description: '表情ID' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post(':id/use')
  async incrementUseCount(@Param('id') id: string) {
    await this.emojiService.incrementUseCount(+id);
    return {
      success: true,
      message: 'response.success.emojiUseCountIncremented',
    };
  }

  @ApiOperation({ summary: '获取表情分类列表' })
  @Get('categories/list')
  async getCategories() {
    return this.emojiService.getCategories();
  }

  @ApiOperation({ summary: '获取热门表情' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @Get('popular/list')
  async getPopular(@Query('limit') limit?: string) {
    return this.emojiService.getPopular(limit ? +limit : 20);
  }

  @ApiOperation({ summary: '获取最近添加的表情' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('recent/list')
  async getRecent(@Query('limit') limit: string, @Req() req: any) {
    return this.emojiService.getRecent(req.user, limit ? +limit : 20);
  }
}
