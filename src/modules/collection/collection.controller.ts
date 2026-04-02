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
import { CollectionService } from './collection.service';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { QueryCollectionDto } from './dto/query-collection.dto';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { User } from '../user/entities/user.entity';

@ApiTags('合集管理')
@Controller('collection')
export class CollectionController {
  constructor(private readonly collectionService: CollectionService) { }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建合集' })
  create(@Request() req: Request & { user: User }, @Body() createCollectionDto: CreateCollectionDto) {
    return this.collectionService.create(req.user.id, createCollectionDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '获取合集列表' })
  findAll(@Request() req: Request & { user: User }, @Query() queryDto: QueryCollectionDto) {
    return this.collectionService.findAll(req.user, queryDto);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '获取合集详情' })
  @ApiParam({ name: 'id', description: '合集ID' })
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req: Request & { user: User }) {
    return this.collectionService.findOne(id, req.user.id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新合集' })
  @ApiParam({ name: 'id', description: '合集ID' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: Request & { user: User },
    @Body() updateCollectionDto: UpdateCollectionDto,
  ) {
    return this.collectionService.update(id, req.user.id, updateCollectionDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除合集' })
  @ApiParam({ name: 'id', description: '合集ID' })
  remove(@Param('id', ParseIntPipe) id: number, @Request() req: Request & { user: User }) {
    return this.collectionService.remove(id, req.user.id);
  }

  @Post(':id/article/:articleId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '添加文章到合集' })
  @ApiParam({ name: 'id', description: '合集ID' })
  @ApiParam({ name: 'articleId', description: '文章ID' })
  addToCollection(
    @Param('id', ParseIntPipe) collectionId: number,
    @Param('articleId', ParseIntPipe) articleId: number,
    @Request() req: Request & { user: User },
  ) {
    return this.collectionService.addToCollection(req.user.id, collectionId, articleId);
  }

  @Delete(':id/article/:articleId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '从合集移除文章' })
  @ApiParam({ name: 'id', description: '合集ID' })
  @ApiParam({ name: 'articleId', description: '文章ID' })
  removeFromCollection(
    @Param('id', ParseIntPipe) collectionId: number,
    @Param('articleId', ParseIntPipe) articleId: number,
    @Request() req: Request & { user: User },
  ) {
    return this.collectionService.removeFromCollection(req.user.id, collectionId, articleId);
  }

  @Get(':id/items')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '获取合集中的文章列表' })
  @ApiParam({ name: 'id', description: '合集ID' })
  @ApiQuery({ name: 'page', required: false, description: '页码' })
  @ApiQuery({ name: 'limit', required: false, description: '每页数量' })
  getCollectionItems(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: Request & { user: User },
    @Query() pagination: PaginationDto
  ) {
    return this.collectionService.getCollectionItems(id, req.user, pagination);
  }

  @Get('check/:articleId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '检查文章是否在合集中' })
  @ApiParam({ name: 'articleId', description: '文章ID' })
  checkArticleInCollections(@Param('articleId', ParseIntPipe) articleId: number, @Request() req: Request & { user: User }) {
    return this.collectionService.checkArticleInCollections(req.user.id, articleId);
  }

  @Get('article/:articleId/info')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取文章所在的合集信息' })
  @ApiParam({ name: 'articleId', description: '文章ID' })
  getArticleCollectionInfo(@Param('articleId', ParseIntPipe) articleId: number, @Request() req: Request & { user: User }) {
    return this.collectionService.getArticleCollectionInfo(req.user.id, articleId);
  }
}
