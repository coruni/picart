import { Controller, Get, Post, Body, Patch, Param, UseGuards } from '@nestjs/common';
import { ConfigService } from './config.service';
import { CreateConfigDto } from './dto/create-config.dto';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { PermissionGuard } from 'src/common/guards/permission.guard';

@ApiTags('系统配置')
@Controller('config')
export class ConfigController {
  constructor(private readonly configService: ConfigService) { }

  @Post()
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('setting:create')
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建配置' })
  @ApiResponse({ status: 201, description: '创建成功' })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '权限不足' })
  create(@Body() createConfigDto: CreateConfigDto) {
    return this.configService.create(createConfigDto);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('setting:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取所有配置' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '权限不足' })
  findAll() {
    return this.configService.findAll();
  }

  @Get('group/:group')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('setting:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: '根据分组获取配置' })
  @ApiParam({ name: 'group', description: '配置分组', type: 'string' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '权限不足' })
  findByGroup(@Param('group') group: string) {
    return this.configService.findByGroup(group);
  }

  @Patch()
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('setting:update')
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新所有配置' })
  @ApiResponse({ status: 200, description: '更新成功' })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '权限不足' })
  updateAll(@Body() configs: any[]) {
    return this.configService.updateAll(configs);
  }

  @Patch('group/:group')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('setting:update')
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新分组配置' })
  @ApiParam({ name: 'group', description: '配置分组', type: 'string' })
  @ApiResponse({ status: 200, description: '更新成功' })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '权限不足' })
  updateGroup(@Param('group') group: string, @Body() configs: any[]) {
    return this.configService.updateGroup(group, configs);
  }

  /**
   * 获取所有公共配置
   */
  @Get('public')
  @ApiOperation({ summary: '获取所有公共配置' })
  @ApiResponse({ status: 200, description: '获取成功' })
  getPublicConfigs() {
    return this.configService.getPublicConfigs();
  }

  /**
   * 获取广告配置
   */
  @Get('advertisement')
  @ApiOperation({ summary: '获取广告配置' })
  @ApiResponse({ status: 200, description: '获取成功' })
  getAdvertisementConfig() {
    return this.configService.getAdvertisementConfig();
  }
}
