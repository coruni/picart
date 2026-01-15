import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  Delete,
  UseGuards,
  Req,
  Query,
  Patch,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Permissions } from "src/common/decorators/permissions.decorator";
import { PermissionGuard } from "src/common/guards/permission.guard";
import { BannerService } from "./banner.service";
import { CreateBannerDto } from "./dto/create-banner.dto";
import { UpdateBannerDto } from "./dto/update-banner.dto";
import { Banner } from "./entities/banner.entity";
import { JwtAuthGuard } from "src/common/guards/jwt-auth.guard";
import { PaginationDto } from "src/common/dto/pagination.dto";
import { NoAuth } from "src/common/decorators/no-auth.decorator";
import { ApiOperation, ApiTags, ApiBearerAuth, ApiResponse, ApiParam, ApiQuery } from "@nestjs/swagger";

@Controller("banners")
@ApiTags('轮播管理')
@ApiBearerAuth()
export class BannerController {
  constructor(private readonly bannerService: BannerService) { }

  @Post()
  @UseGuards(AuthGuard("jwt"), PermissionGuard)
  @ApiOperation({ summary: '创建轮播' })
  @ApiResponse({ status: 201, description: '创建成功' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '无权限' })
  @Permissions("banner:create")
  async create(@Body() createBannerDto: CreateBannerDto) {
    return await this.bannerService.create(createBannerDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '获取所有轮播' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 401, description: '未授权' })
  @Permissions("banner:list")
  async findAll(@Query() paginationDto: PaginationDto) {
    return await this.bannerService.findAll(paginationDto);
  }

  @Get("active")
  @ApiOperation({ summary: '获取活动轮播' })
  @ApiResponse({ status: 200, description: '获取成功', type: [Banner] })
  async findActive() {
    return await this.bannerService.findActive();
  }

  @Get(":id")
  @ApiOperation({ summary: '获取轮播详情' })
  @ApiParam({ name: 'id', description: '轮播ID', type: Number })
  @ApiResponse({ status: 200, description: '获取成功', type: Banner })
  @ApiResponse({ status: 404, description: '轮播不存在' })
  async findOne(@Param("id") id: string) {
    return await this.bannerService.findOne(+id);
  }

  @Patch(":id")
  @UseGuards(AuthGuard("jwt"), PermissionGuard)
  @ApiOperation({ summary: '更新轮播' })
  @ApiParam({ name: 'id', description: '轮播ID', type: Number })
  @ApiResponse({ status: 200, description: '更新成功' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '无权限' })
  @ApiResponse({ status: 404, description: '轮播不存在' })
  @Permissions("banner:update")
  async update(
    @Param("id") id: string,
    @Body() updateBannerDto: UpdateBannerDto,
  ) {
    return await this.bannerService.update(+id, updateBannerDto);
  }

  @Delete(":id")
  @UseGuards(AuthGuard("jwt"), PermissionGuard)
  @ApiOperation({ summary: '删除轮播' })
  @ApiParam({ name: 'id', description: '轮播ID', type: Number })
  @ApiResponse({ status: 200, description: '删除成功' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '无权限' })
  @ApiResponse({ status: 404, description: '轮播不存在' })
  @Permissions("banner:delete")
  async remove(@Param("id") id: string) {
    return await this.bannerService.remove(+id);
  }
}
