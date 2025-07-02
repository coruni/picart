import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { RoleService } from './role.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AuthGuard } from '@nestjs/passport';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { PermissionGuard } from 'src/common/guards/permission.guard';

@Controller('role')
@ApiTags('角色管理')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('role:create')
  @ApiOperation({ summary: '创建角色' })
  @ApiBearerAuth()
  @ApiBody({ type: CreateRoleDto })
  @ApiResponse({ status: 201, description: '创建成功，返回创建的角色信息' })
  @ApiResponse({ status: 400, description: '请求参数不合法' })
  @ApiResponse({ status: 401, description: '未授权访问' })
  @ApiResponse({ status: 403, description: '权限不足' })
  create(@Body() createRoleDto: CreateRoleDto) {
    return this.roleService.create(createRoleDto);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'))
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('role:read')
  @ApiOperation({ summary: '获取所有角色' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: '获取成功，返回角色列表' })
  @ApiResponse({ status: 401, description: '未授权访问' })
  @ApiResponse({ status: 403, description: '权限不足' })
  findAll() {
    return this.roleService.findAll();
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('role:read')
  @ApiOperation({ summary: '获取单个角色' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: '角色ID' })
  @ApiResponse({ status: 200, description: '获取成功，返回角色信息' })
  @ApiResponse({ status: 401, description: '未授权访问' })
  @ApiResponse({ status: 403, description: '权限不足' })
  @ApiResponse({ status: 404, description: '角色不存在' })
  findOne(@Param('id') id: string) {
    return this.roleService.findOne(+id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('role:update')
  @ApiOperation({ summary: '更新角色' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: '角色ID' })
  @ApiBody({ type: UpdateRoleDto })
  @ApiResponse({ status: 200, description: '更新成功，返回更新后的角色信息' })
  @ApiResponse({ status: 400, description: '请求参数不合法' })
  @ApiResponse({ status: 401, description: '未授权访问' })
  @ApiResponse({ status: 403, description: '权限不足' })
  @ApiResponse({ status: 404, description: '角色不存在' })
  update(@Param('id') id: string, @Body() updateRoleDto: UpdateRoleDto) {
    return this.roleService.update(+id, updateRoleDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('role:delete')
  @ApiOperation({ summary: '删除角色' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: '角色ID' })
  @ApiResponse({ status: 200, description: '删除成功' })
  @ApiResponse({ status: 401, description: '未授权访问' })
  @ApiResponse({ status: 403, description: '权限不足' })
  @ApiResponse({ status: 404, description: '角色不存在' })
  remove(@Param('id') id: string) {
    return this.roleService.remove(+id);
  }
}
