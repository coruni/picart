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
import { BaseResponseDto, ListResponseDto } from 'src/common/dto/response.dto';
import { Tag } from './entities/tag.entity';
import { TagService } from './tag.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { AuthGuard } from '@nestjs/passport';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { PermissionGuard } from 'src/common/guards/permission.guard';
import { PaginationDto } from 'src/common/dto/pagination.dto';

@Controller('tag')
@ApiTags('标签管理')
@ApiBearerAuth()
export class TagController {
  constructor(private readonly tagService: TagService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('tag:create')
  @ApiOperation({ summary: '创建标签' })
  @ApiResponse({ status: 201, description: '创建成功', type: BaseResponseDto<Tag> })
  @ApiResponse({ status: 400, description: '请求参数错误', type: BaseResponseDto })
  @ApiResponse({ status: 401, description: '未授权', type: BaseResponseDto })
  @ApiResponse({ status: 403, description: '权限不足', type: BaseResponseDto })
  create(@Body() createTagDto: CreateTagDto) {
    return this.tagService.create(createTagDto);
  }

  @Get()
  @ApiOperation({ summary: '获取所有标签' })
  @ApiResponse({ status: 200, description: '获取成功', type: ListResponseDto<Tag> })
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('tag:read')
  findAll(@Query() pagination: PaginationDto) {
    return this.tagService.findAll(pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取标签详情' })
  @ApiResponse({ status: 200, description: '获取成功', type: BaseResponseDto<Tag> })
  @ApiResponse({ status: 404, description: '标签不存在', type: BaseResponseDto })
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('tag:read')
  findOne(@Param('id') id: string) {
    return this.tagService.findOne(+id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('tag:update')
  @ApiOperation({ summary: '更新标签' })
  @ApiResponse({ status: 200, description: '更新成功', type: BaseResponseDto<Tag> })
  @ApiResponse({ status: 400, description: '请求参数错误', type: BaseResponseDto })
  @ApiResponse({ status: 401, description: '未授权', type: BaseResponseDto })
  @ApiResponse({ status: 403, description: '权限不足', type: BaseResponseDto })
  @ApiResponse({ status: 404, description: '标签不存在', type: BaseResponseDto })
  update(@Param('id') id: string, @Body() updateTagDto: UpdateTagDto) {
    return this.tagService.update(+id, updateTagDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('tag:delete')
  @ApiOperation({ summary: '删除标签' })
  @ApiResponse({ status: 200, description: '删除成功', type: BaseResponseDto })
  @ApiResponse({ status: 401, description: '未授权', type: BaseResponseDto })
  @ApiResponse({ status: 403, description: '权限不足', type: BaseResponseDto })
  @ApiResponse({ status: 404, description: '标签不存在', type: BaseResponseDto })
  remove(@Param('id') id: string) {
    return this.tagService.remove(+id);
  }

  @Post(':id/follow')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: '关注标签' })
  @ApiResponse({ status: 200, description: '关注成功', type: BaseResponseDto })
  @ApiResponse({ status: 401, description: '未授权', type: BaseResponseDto })
  @ApiResponse({ status: 404, description: '标签不存在', type: BaseResponseDto })
  follow(@Param('id') id: string) {
    return this.tagService.incrementFollowCount(+id);
  }

  @Delete(':id/follow')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: '取消关注标签' })
  @ApiResponse({ status: 200, description: '取消关注成功', type: BaseResponseDto })
  @ApiResponse({ status: 401, description: '未授权', type: BaseResponseDto })
  @ApiResponse({ status: 404, description: '标签不存在', type: BaseResponseDto })
  unfollow(@Param('id') id: string) {
    return this.tagService.decrementFollowCount(+id);
  }
}
