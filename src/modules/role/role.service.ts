import { Injectable, OnModuleInit, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { Role } from './entities/role.entity';
import { Permission } from '../permission/entities/permission.entity';
import { PermissionService } from '../permission/permission.service';
import { ListUtil } from 'src/common/utils';
import { PaginationDto } from 'src/common/dto/pagination.dto';

@Injectable()
export class RoleService implements OnModuleInit {
  private readonly SUPER_ADMIN_ROLE_NAME = 'super-admin';
  private readonly SUPER_ADMIN_ROLE_DISPLAY_NAME = '超级管理员';
  private readonly USER_ROLE_NAME = 'user';
  private readonly USER_ROLE_DISPLAY_NAME = '普通用户';

  constructor(
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    @InjectRepository(Permission)
    private permissionRepository: Repository<Permission>,
    private permissionService: PermissionService,
  ) {}

  async onModuleInit() {
    await this.permissionService.initPromise;
    await this.initializeRoles();
  }

  /**
   * 初始化系统角色
   */
  private async initializeRoles() {
    await this.initializeSuperAdmin();
    await this.initializeUserRole();
  }

  /**
   * 初始化超级管理员角色
   */
  /**
   * 初始化超级管理员角色
   * 检测是否有缺失的权限并补齐
   */
  private async initializeSuperAdmin() {
    // 检查是否已存在超级管理员角色
    let superAdminRole = await this.roleRepository.findOne({
      where: { name: this.SUPER_ADMIN_ROLE_NAME },
      relations: ['permissions'],
    });

    // 获取所有权限
    const allPermissions = await this.permissionRepository.find();

    if (!superAdminRole) {
      // 创建超级管理员角色
      const createRoleDto: CreateRoleDto = {
        name: this.SUPER_ADMIN_ROLE_NAME,
        displayName: this.SUPER_ADMIN_ROLE_DISPLAY_NAME,
        description: '超级管理员，拥有所有权限',
        permissionIds: allPermissions.map((p) => p.id),
        isActive: true,
        isSystem: true,
      };

      const { data } = await this.create(createRoleDto);
      superAdminRole = data;
    } else {
      // 检查是否有缺失的权限，补齐
      const currentPermissionIds = superAdminRole.permissions?.map((p) => p.id) || [];
      const allPermissionIds = allPermissions.map((p) => p.id);
      const missingPermissionIds = allPermissionIds.filter(
        (id) => !currentPermissionIds.includes(id),
      );
      if (missingPermissionIds.length > 0) {
        // 合并已有和缺失的权限
        const updatedPermissionIds = Array.from(
          new Set([...currentPermissionIds, ...missingPermissionIds]),
        );
        superAdminRole.permissions = await this.permissionRepository.find({
          where: { id: In(updatedPermissionIds) },
        });
        await this.roleRepository.save(superAdminRole);
      }
    }
  }

  /**
   * 初始化普通用户角色
   * 检测是否有缺失的权限并补齐
   */
  private async initializeUserRole() {
    // 检查是否已存在普通用户角色
    let userRole = await this.roleRepository.findOne({
      where: { name: this.USER_ROLE_NAME },
      relations: ['permissions'],
    });

    // 基础权限名称列表
    const basicPermissionNames = [
      'article:read',
      'article:create',
      'article:update',
      'article:delete',
      'comment:read',
      'comment:create',
      'comment:update',
      'comment:delete',
      'category:read',
      'tag:read',
      'user:read',
      'user:update',
      'upload:info',
      'upload:create',
      // 订单相关权限 - 普通用户只能管理自己的订单
      'order:read',
      'order:create',
      'order:cancel',
      'order:refund',
      // 举报相关权限 - 普通用户可以创建和查看自己的举报
      'report:read',
      'report:create',
      // 装饰品相关权限 - 普通用户可以查看、购买和使用装饰品
      'decoration:read',
      'decoration:purchase',
      'decoration:equip',
      'decoration:gift',
      // 积分相关权限 - 普通用户可以查看积分和领取任务奖励
      'points:view',
      'points:claim',
    ];

    // 获取基础权限
    const basicPermissions = await this.permissionRepository.find({
      where: basicPermissionNames.map((name) => ({ name })),
    });

    if (!userRole) {
      // 创建普通用户角色
      const createRoleDto: CreateRoleDto = {
        name: this.USER_ROLE_NAME,
        displayName: this.USER_ROLE_DISPLAY_NAME,
        description: '普通用户，拥有基础权限',
        permissionIds: basicPermissions.map((p) => p.id),
        isActive: true,
        isSystem: true,
      };

      const { data } = await this.create(createRoleDto);
      userRole = data;
    } else {
      // 检查是否有缺失的权限，补齐
      const currentPermissionIds = userRole.permissions?.map((p) => p.id) || [];
      const basicPermissionIds = basicPermissions.map((p) => p.id);
      const missingPermissionIds = basicPermissionIds.filter(
        (id) => !currentPermissionIds.includes(id),
      );
      if (missingPermissionIds.length > 0) {
        // 合并已有和缺失的权限
        const updatedPermissionIds = Array.from(
          new Set([...currentPermissionIds, ...missingPermissionIds]),
        );
        userRole.permissions = await this.permissionRepository.find({
          where: { id: In(updatedPermissionIds) },
        });
        await this.roleRepository.save(userRole);
      }
    }
  }

  /**
   * 创建角色
   */
  async create(createRoleDto: CreateRoleDto) {
    const { permissionIds, ...roleData } = createRoleDto;

    // 检查角色名称是否已存在
    const existingRole = await this.roleRepository.findOne({
      where: { name: roleData.name },
    });
    if (existingRole) {
      throw new BadRequestException('response.error.roleNameExists');
    }

    // 创建角色实体
    const role = this.roleRepository.create({
      ...roleData,
      isActive: roleData.isActive ?? true,
      isSystem: roleData.isSystem ?? false,
    });

    // 如果指定了权限ID，关联权限
    if (permissionIds && permissionIds.length > 0) {
      const permissions = await this.permissionRepository.find({
        where: { id: In(permissionIds) },
      });
      role.permissions = permissions;
    }

    const savedRole = await this.roleRepository.save(role);
    return {
      success: true,
      message: 'response.success.roleCreate',
      data: savedRole,
    };
  }

  /**
   * 查询所有角色（不分页）
   */
  async findAllRoles() {
    const data = await this.roleRepository.find({
      relations: ['permissions'],
      order: {
        id: 'ASC',
      },
    });

    return ListUtil.buildSimpleList(data);
  }

  /**
   * 根据ID查询角色详情
   */
  async findOne(id: number) {
    const role = await this.roleRepository.findOne({
      where: { id },
      relations: ['permissions'],
    });

    if (!role) {
      throw new NotFoundException('response.error.roleNotFound');
    }

    return role;
  }

  /**
   * 更新角色
   */
  async update(id: number, updateRoleDto: UpdateRoleDto) {
    const { permissionIds, ...roleData } = updateRoleDto;
    const role = await this.findOne(id);

    // 系统角色保护：不允许修改系统角色的名称和系统标识
    if (role.isSystem) {
      if (roleData.name && roleData.name !== role.name) {
        throw new ForbiddenException('response.error.cannotModifySystemRoleName');
      }
      if (roleData.isSystem === false) {
        throw new ForbiddenException('response.error.cannotModifySystemRoleFlag');
      }
    }

    // 如果要修改角色名称，检查是否与其他角色冲突
    if (roleData.name && roleData.name !== role.name) {
      const existingRole = await this.roleRepository.findOne({
        where: { name: roleData.name },
      });
      if (existingRole) {
        throw new BadRequestException('response.error.roleNameExists');
      }
    }

    // 更新权限关联
    if (permissionIds !== undefined) {
      const permissions = await this.permissionRepository.find({
        where: { id: In(permissionIds) },
      });
      role.permissions = permissions;
    }

    // 更新其他字段
    Object.assign(role, roleData);
    const updatedRole = await this.roleRepository.save(role);
    return {
      success: true,
      message: 'response.success.roleUpdate',
      data: updatedRole,
    };
  }

  /**
   * 删除角色
   */
  async removeRole(id: number) {
    const role = await this.findOne(id);

    // 系统角色保护：不允许删除系统角色
    if (role.isSystem) {
      throw new ForbiddenException('response.error.cannotDeleteSystemRole');
    }

    // 检查是否有用户正在使用该角色
    const userCount = await this.roleRepository
      .createQueryBuilder('role')
      .leftJoin('role.users', 'user')
      .where('role.id = :id', { id })
      .getCount();

    if (userCount > 0) {
      throw new BadRequestException('response.error.roleInUseCannotDelete');
    }

    await this.roleRepository.remove(role);
    return { success: true, message: 'response.success.roleDelete' };
  }



  /**
   * 分页查询角色列表
   */
  async findRolesWithPagination(pagination: PaginationDto, name?: string, isActive?: boolean) {
    const { page, limit } = pagination;
    const queryBuilder = this.roleRepository.createQueryBuilder('role')
      .leftJoinAndSelect('role.permissions', 'permissions')
      .orderBy('role.id', 'ASC');

    // 添加搜索条件
    if (name) {
      queryBuilder.andWhere('role.name LIKE :name OR role.displayName LIKE :name', {
        name: `%${name}%`,
      });
    }

    if (isActive !== undefined) {
      queryBuilder.andWhere('role.isActive = :isActive', { isActive });
    }

    const [data, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return ListUtil.fromFindAndCount([data, total], page, limit);
  }

  /**
   * 为角色分配权限（替换现有权限）
   */
  async assignPermissions(id: number, assignPermissionsDto: AssignPermissionsDto) {
    const role = await this.findOne(id);
    const { permissionIds } = assignPermissionsDto;

    // 系统角色保护：不允许修改超级管理员角色的权限
    if (role.name === this.SUPER_ADMIN_ROLE_NAME) {
      throw new ForbiddenException('response.error.cannotModifySuperAdminPermissions');
    }

    const permissions = await this.permissionRepository.find({
      where: { id: In(permissionIds) },
    });

    role.permissions = permissions;
    const updatedRole = await this.roleRepository.save(role);

    return {
      success: true,
      message: 'response.success.permissionsAssigned',
      data: updatedRole,
    };
  }



  /**
   * 启用/禁用角色
   */
  async toggleRoleStatus(id: number, isActive: boolean) {
    const role = await this.findOne(id);

    // 系统角色保护：不允许禁用超级管理员角色
    if (role.name === this.SUPER_ADMIN_ROLE_NAME && !isActive) {
      throw new ForbiddenException('response.error.cannotDisableSuperAdminRole');
    }

    role.isActive = isActive;
    const updatedRole = await this.roleRepository.save(role);

    return {
      success: true,
      message: isActive ? 'response.success.roleEnabled' : 'response.success.roleDisabled',
      data: updatedRole,
    };
  }

  /**
   * 获取活跃角色列表
   */
  async getActiveRoles() {
    const roles = await this.roleRepository.find({
      where: { isActive: true },
      relations: ['permissions'],
      order: { id: 'ASC' },
    });

    return ListUtil.buildSimpleList(roles);
  }

  /**
   * 复制角色
   */
  async copyRole(id: number, newName: string, newDisplayName?: string) {
    const originalRole = await this.findOne(id);

    // 检查新角色名称是否已存在
    const existingRole = await this.roleRepository.findOne({
      where: { name: newName },
    });
    if (existingRole) {
      throw new BadRequestException('response.error.roleNameExists');
    }

    // 创建新角色
    const newRole = this.roleRepository.create({
      name: newName,
      displayName: newDisplayName || `${originalRole.displayName || originalRole.name} - 副本`,
      description: `${originalRole.description} (副本)`,
      permissions: originalRole.permissions,
      isActive: true,
      isSystem: false,
    });

    const savedRole = await this.roleRepository.save(newRole);

    return {
      success: true,
      message: 'response.success.roleCopied',
      data: savedRole,
    };
  }
}
