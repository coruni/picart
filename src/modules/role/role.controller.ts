import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { RoleService } from './role.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { PermissionGuard } from 'src/common/guards/permission.guard';
import { Role } from './entities/role.entity';

@Controller('role')
@ApiTags('角色管理')
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@ApiBearerAuth()
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Post()
  @ApiOperation({ summary: '创建角色' })
  @ApiResponse({ status: 201, description: '创建成功', type: Role })
  @Permissions('role:create')
  create(@Body() createRoleDto: CreateRoleDto) {
    return this.roleService.create(createRoleDto);
  }

  @Get()
  @ApiOperation({ summary: '获取所有角色' })
  @ApiResponse({ status: 200, description: '获取成功', type: [Role] })
  @Permissions('role:read')
  findAll() {
    return this.roleService.findAllRoles();
  }

  @Get(':id')
  @ApiOperation({ summary: '根据ID获取角色' })
  @ApiResponse({ status: 200, description: '获取成功', type: Role })
  @Permissions('role:read')
  findOne(@Param('id') id: string) {
    return this.roleService.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新角色' })
  @ApiResponse({ status: 200, description: '更新成功', type: Role })
  @Permissions('role:update')
  update(@Param('id') id: string, @Body() updateRoleDto: UpdateRoleDto) {
    return this.roleService.update(+id, updateRoleDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除角色' })
  @ApiResponse({ status: 200, description: '删除成功' })
  @Permissions('role:delete')
  remove(@Param('id') id: string) {
    return this.roleService.removeRole(+id);
  }
}
