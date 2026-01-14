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
  ParseIntPipe,
} from '@nestjs/common';
import { FavoriteService } from './favorite.service';
import { CreateFavoriteDto } from './dto/create-favorite.dto';
import { UpdateFavoriteDto } from './dto/update-favorite.dto';
import { AddToFavoriteDto } from './dto/add-to-favorite.dto';
import { QueryFavoriteDto } from './dto/query-favorite.dto';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PaginationDto } from 'src/common/dto/pagination.dto';

@ApiTags('收藏管理')
@Controller('favorite')
export class FavoriteController {
  constructor(private readonly favoriteService: FavoriteService) { }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建收藏夹' })
  create(@Request() req, @Body() createFavoriteDto: CreateFavoriteDto) {
    return this.favoriteService.create(req.user.id, createFavoriteDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '获取收藏夹列表' })
  findAll(@Request() req, @Query() queryDto: QueryFavoriteDto) {
    return this.favoriteService.findAll(req.user?.id, queryDto);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '获取收藏夹详情' })
  @ApiParam({ name: 'id', description: '收藏夹ID' })
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.favoriteService.findOne(id, req.user?.id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新收藏夹' })
  @ApiParam({ name: 'id', description: '收藏夹ID' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
    @Body() updateFavoriteDto: UpdateFavoriteDto,
  ) {
    return this.favoriteService.update(id, req.user.id, updateFavoriteDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除收藏夹' })
  @ApiParam({ name: 'id', description: '收藏夹ID' })
  remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.favoriteService.remove(id, req.user.id);
  }

  @Post('add')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '添加文章到收藏夹' })
  addToFavorite(@Request() req, @Body() addToFavoriteDto: AddToFavoriteDto) {
    return this.favoriteService.addToFavorite(req.user.id, addToFavoriteDto);
  }

  @Delete(':favoriteId/article/:articleId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '从收藏夹移除文章' })
  @ApiParam({ name: 'favoriteId', description: '收藏夹ID' })
  @ApiParam({ name: 'articleId', description: '文章ID' })
  removeFromFavorite(
    @Param('favoriteId', ParseIntPipe) favoriteId: number,
    @Param('articleId', ParseIntPipe) articleId: number,
    @Request() req,
  ) {
    return this.favoriteService.removeFromFavorite(req.user.id, favoriteId, articleId);
  }

  @Get(':id/items')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '获取收藏夹中的文章列表' })
  @ApiParam({ name: 'id', description: '收藏夹ID' })
  @ApiQuery({ name: 'page', required: false, description: '页码' })
  @ApiQuery({ name: 'limit', required: false, description: '每页数量' })
  getFavoriteItems(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
    @Query() pagination: PaginationDto
  ) {

    return this.favoriteService.getFavoriteItems(id, req.user?.id, pagination);
  }

  @Get('check/:articleId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '检查文章是否在收藏夹中' })
  @ApiParam({ name: 'articleId', description: '文章ID' })
  checkArticleInFavorites(@Param('articleId', ParseIntPipe) articleId: number, @Request() req) {
    return this.favoriteService.checkArticleInFavorites(req.user.id, articleId);
  }

  @Get('article/:articleId/info')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取文章所在的收藏夹信息' })
  @ApiParam({ name: 'articleId', description: '文章ID' })
  getArticleFavoriteInfo(@Param('articleId', ParseIntPipe) articleId: number, @Request() req) {
    return this.favoriteService.getArticleFavoriteInfo(req.user.id, articleId);
  }
}
