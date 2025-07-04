import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ArticleService } from './article.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { AuthGuard } from '@nestjs/passport';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { PermissionGuard } from 'src/common/guards/permission.guard';
import { PaginationDto } from 'src/common/dto/pagination.dto';

@Controller('article')
@ApiTags('文章管理')
@ApiBearerAuth()
export class ArticleController {
  constructor(private readonly articleService: ArticleService) {}

  @Post()
  @ApiOperation({ summary: '创建文章' })
  @ApiResponse({ status: 201, description: '创建成功' })
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('article:create')
  create(@Body() createArticleDto: CreateArticleDto, @Req() req) {
    return this.articleService.createArticle(createArticleDto, req.user);
  }

  @Get()
  @ApiOperation({ summary: '获取文章列表' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('article:read')
  findAll(@Query() pagination: PaginationDto, @Query('title') title?: string) {
    return this.articleService.findAllArticles(pagination, title);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取文章详情' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 404, description: '文章不存在' })
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('article:read')
  findOne(@Param('id') id: string) {
    return this.articleService.findOne(+id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('article:update')
  @ApiOperation({ summary: '更新文章' })
  @ApiResponse({ status: 200, description: '更新成功' })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '权限不足' })
  @ApiResponse({ status: 404, description: '文章不存在' })
  update(@Param('id') id: string, @Body() updateArticleDto: UpdateArticleDto) {
    return this.articleService.update(+id, updateArticleDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('article:delete')
  @ApiOperation({ summary: '删除文章' })
  @ApiResponse({ status: 200, description: '删除成功' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '权限不足' })
  @ApiResponse({ status: 404, description: '文章不存在' })
  remove(@Param('id') id: string) {
    return this.articleService.remove(+id);
  }

  @Post(':id/like')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: '点赞/取消点赞文章' })
  @ApiResponse({ status: 200, description: '操作成功' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 404, description: '文章不存在' })
  like(@Param('id') id: string, @Request() req) {
    return this.articleService.like(+id, req.user);
  }

  @Get(':id/like/status')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: '获取文章点赞状态' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 404, description: '文章不存在' })
  getLikeStatus(@Param('id') id: string, @Request() req) {
    return this.articleService.getLikeStatus(+id, req.user.id);
  }

  @Get(':id/like/count')
  @ApiOperation({ summary: '获取文章点赞数量' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 404, description: '文章不存在' })
  getLikeCount(@Param('id') id: string) {
    return this.articleService.getLikeCount(+id);
  }
}
