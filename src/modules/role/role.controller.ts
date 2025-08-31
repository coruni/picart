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
} from "@nestjs/common";
import { RoleService } from "./role.service";
import { CreateRoleDto } from "./dto/create-role.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { AssignPermissionsDto } from "./dto/assign-permissions.dto";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { Permissions } from "src/common/decorators/permissions.decorator";
import { PermissionGuard } from "src/common/guards/permission.guard";
import { Role } from "./entities/role.entity";
import { PaginationDto } from "src/common/dto/pagination.dto";

@Controller("role")
@ApiTags("角色管理")
@ApiBearerAuth()
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Post()
  @ApiOperation({ summary: "创建角色" })
  @UseGuards(AuthGuard("jwt"), PermissionGuard)
  @Permissions("role:create")
  @ApiResponse({ status: 201, description: "创建成功", type: Role })
  create(@Body() createRoleDto: CreateRoleDto) {
    return this.roleService.create(createRoleDto);
  }

  @Get()
  @ApiOperation({ summary: "获取所有角色" })
  @ApiResponse({ status: 200, description: "获取成功", type: [Role] })
  @Permissions("role:read")
  findAll() {
    return this.roleService.findAllRoles();
  }

  @Get("list")
  @ApiOperation({ summary: "分页获取角色列表" })
  @ApiResponse({ status: 200, description: "获取成功" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "name", required: false, type: String })
  @ApiQuery({ name: "isActive", required: false, type: Boolean })
  @Permissions("role:read")
  findWithPagination(
    @Query() pagination: PaginationDto,
    @Query("name") name?: string,
    @Query("isActive") isActive?: boolean,
  ) {
    return this.roleService.findRolesWithPagination(pagination, name, isActive);
  }

  @Get("active")
  @ApiOperation({ summary: "获取活跃角色列表" })
  @ApiResponse({ status: 200, description: "获取成功" })
  @Permissions("role:read")
  getActiveRoles() {
    return this.roleService.getActiveRoles();
  }

  @Get(":id")
  @ApiOperation({ summary: "根据ID获取角色" })
  @ApiResponse({ status: 200, description: "获取成功", type: Role })
  @Permissions("role:read")
  findOne(@Param("id") id: string) {
    return this.roleService.findOne(+id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "更新角色" })
  @ApiResponse({ status: 200, description: "更新成功", type: Role })
  @Permissions("role:update")
  update(@Param("id") id: string, @Body() updateRoleDto: UpdateRoleDto) {
    return this.roleService.update(+id, updateRoleDto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "删除角色" })
  @ApiResponse({ status: 200, description: "删除成功" })
  @Permissions("role:delete")
  remove(@Param("id") id: string) {
    return this.roleService.removeRole(+id);
  }

  // 权限管理相关接口
  @Post(":id/permissions")
  @ApiOperation({ summary: "为角色分配权限" })
  @ApiResponse({ status: 200, description: "分配成功" })
  @Permissions("role:update")
  assignPermissions(
    @Param("id") id: string,
    @Body() assignPermissionsDto: AssignPermissionsDto,
  ) {
    return this.roleService.assignPermissions(+id, assignPermissionsDto);
  }

  // 角色状态管理
  @Patch(":id/status")
  @ApiOperation({ summary: "启用/禁用角色" })
  @ApiResponse({ status: 200, description: "状态更新成功" })
  @Permissions("role:update")
  toggleStatus(@Param("id") id: string, @Body() body: { isActive: boolean }) {
    return this.roleService.toggleRoleStatus(+id, body.isActive);
  }

  // 角色复制
  @Post(":id/copy")
  @ApiOperation({ summary: "复制角色" })
  @ApiResponse({ status: 200, description: "复制成功" })
  @Permissions("role:create")
  copyRole(
    @Param("id") id: string,
    @Body() body: { name: string; displayName?: string },
  ) {
    return this.roleService.copyRole(+id, body.name, body.displayName);
  }
}
