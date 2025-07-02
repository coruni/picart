import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { ConfigService } from './config.service';
import { CreateConfigDto } from './dto/create-config.dto';
import { UpdateConfigDto } from './dto/update-config.dto';
import { AuthGuard } from '@nestjs/passport';
import { User } from '../user/entities/user.entity';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBearerAuth, 
  ApiParam 
} from '@nestjs/swagger';
import { LoggerUtil, PermissionUtil } from 'src/common/utils';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { PermissionGuard } from 'src/common/guards/permission.guard';

@ApiTags('系统配置')
@Controller('config')
export class ConfigController {
  constructor(private readonly configService: ConfigService) { }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建配置' })
  @ApiResponse({ status: 201, description: '创建成功' })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '权限不足' })
  create(
    @Body() createConfigDto: CreateConfigDto,
    @Request() req: Request & { user: User }
  ) {
    if (!PermissionUtil.hasPermission(req.user, 'setting:manage')) {
      throw new Error('权限不足');
    }
    return this.configService.create(createConfigDto);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取所有配置' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '权限不足' })
  findAll(@Request() req: Request & { user: User }) {
    if (!PermissionUtil.hasPermission(req.user, 'setting:read')) {
      throw new Error('权限不足');
    }
    return this.configService.findAll();
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取配置详情' })
  @ApiParam({ name: 'id', description: '配置ID', type: 'number' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '权限不足' })
  @ApiResponse({ status: 404, description: '配置不存在' })
  findOne(
    @Param('id') id: string,
    @Request() req: Request & { user: User }
  ) {
    if (!PermissionUtil.hasPermission(req.user, 'setting:read')) {
      throw new Error('权限不足');
    }
    return this.configService.findOne(+id);
  }

  @Get('key/:key')
  @ApiOperation({ summary: '根据键获取配置' })
  @ApiParam({ name: 'key', description: '配置键', type: 'string' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 404, description: '配置不存在' })
  findByKey(@Param('key') key: string) {
    return this.configService.findByKey(key);
  }

  @Get('group/:group')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: '根据分组获取配置' })
  @ApiParam({ name: 'group', description: '配置分组', type: 'string' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '权限不足' })
  findByGroup(
    @Param('group') group: string,
    @Request() req: Request & { user: User }
  ) {
    if (!PermissionUtil.hasPermission(req.user, 'setting:read')) {
      throw new Error('权限不足');
    }
    return this.configService.findByGroup(group);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新配置' })
  @ApiParam({ name: 'id', description: '配置ID', type: 'number' })
  @ApiResponse({ status: 200, description: '更新成功' })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '权限不足' })
  @ApiResponse({ status: 404, description: '配置不存在' })
  update(
    @Param('id') id: string,
    @Body() updateConfigDto: UpdateConfigDto,
    @Request() req: Request & { user: User }
  ) {
    if (!PermissionUtil.hasPermission(req.user, 'setting:update')) {
      throw new Error('权限不足');
    }
    return this.configService.update(+id, updateConfigDto);
  }

  @Patch('key/:key')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: '根据键更新配置' })
  @ApiParam({ name: 'key', description: '配置键', type: 'string' })
  @ApiResponse({ status: 200, description: '更新成功' })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '权限不足' })
  @ApiResponse({ status: 404, description: '配置不存在' })
  updateByKey(
    @Param('key') key: string,
    @Body('value') value: string,
    @Request() req: Request & { user: User }
  ) {
    if (!PermissionUtil.hasPermission(req.user, 'setting:update')) {
      throw new Error('权限不足');
    }
    return this.configService.updateByKey(key, value);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除配置' })
  @ApiParam({ name: 'id', description: '配置ID', type: 'number' })
  @ApiResponse({ status: 200, description: '删除成功' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '权限不足' })
  @ApiResponse({ status: 404, description: '配置不存在' })
  remove(
    @Param('id') id: string,
    @Request() req: Request & { user: User }
  ) {
    if (!PermissionUtil.hasPermission(req.user, 'setting:delete')) {
      throw new Error('权限不足');
    }
    return this.configService.remove(+id);
  }

  @Get('system/info')
  @ApiOperation({ summary: '获取系统信息' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getSystemInfo() {
    const [siteName, maintenanceMode, maintenanceMessage] = await Promise.all([
      this.configService.getSiteName(),
      this.configService.isMaintenanceMode(),
      this.configService.getMaintenanceMessage(),
    ]);

    return {
      siteName,
      maintenanceMode,
      maintenanceMessage,
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    };
  }
}
