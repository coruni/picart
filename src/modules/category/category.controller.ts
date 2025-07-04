import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { AuthGuard } from '@nestjs/passport';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { PermissionGuard } from 'src/common/guards/permission.guard';

@Controller('category')
@ApiTags('分类管理')
@ApiBearerAuth()
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('category:create')
  @ApiOperation({ summary: '创建分类' })
  @ApiResponse({ status: 201, description: '创建成功' })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '权限不足' })
  create(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoryService.create(createCategoryDto);
  }

  @Get()
  @ApiOperation({ summary: '获取所有分类' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('category:read')
  findAll(@Query() query: PaginationDto) {
    return this.categoryService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取分类详情' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 404, description: '分类不存在' })
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('category:read')
  findOne(@Param('id') id: string) {
    return this.categoryService.findOne(+id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('category:update')
  @ApiOperation({ summary: '更新分类' })
  @ApiResponse({ status: 200, description: '更新成功' })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '权限不足' })
  @ApiResponse({ status: 404, description: '分类不存在' })
  update(@Param('id') id: string, @Body() updateCategoryDto: UpdateCategoryDto) {
    return this.categoryService.update(+id, updateCategoryDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('category:delete')
  @ApiOperation({ summary: '删除分类' })
  @ApiResponse({ status: 200, description: '删除成功' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '权限不足' })
  @ApiResponse({ status: 404, description: '分类不存在' })
  remove(@Param('id') id: string) {
    return this.categoryService.remove(+id);
  }
}
