import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { Role } from './entities/role.entity';
import { Permission } from '../permission/entities/permission.entity';
import { PermissionService } from '../permission/permission.service';
import { BaseService } from 'src/common/services/base.service';

@Injectable()
export class RoleService extends BaseService<Role> implements OnModuleInit {
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
  ) {
    super(roleRepository, '角色');
  }

  async onModuleInit() {
    await this.permissionService.initPromise;
    await this.initializeRoles();
  }

  /**
   * 初始化系统角色
   */
  private async initializeRoles(): Promise<void> {
    await this.initializeSuperAdmin();
    await this.initializeUserRole();
  }

  /**
   * 初始化超级管理员角色
   */
  private async initializeSuperAdmin(): Promise<void> {
    // 检查是否已存在超级管理员角色
    let superAdminRole = await this.findOneBy({
      where: { name: this.SUPER_ADMIN_ROLE_NAME },
      relations: ['permissions'],
    });

    if (!superAdminRole) {
      // 获取所有权限
      const allPermissions = await this.permissionRepository.find();

      // 创建超级管理员角色
      const createRoleDto: CreateRoleDto = {
        name: this.SUPER_ADMIN_ROLE_NAME,
        description: '超级管理员，拥有所有权限',
        permissionIds: allPermissions.map(p => p.id),
      };

      superAdminRole = await this.create(createRoleDto);
    }
  }

  /**
   * 初始化普通用户角色
   */
  private async initializeUserRole(): Promise<void> {
    // 检查是否已存在普通用户角色
    let userRole = await this.findOneBy({
      where: { name: this.USER_ROLE_NAME },
      relations: ['permissions'],
    });

    if (!userRole) {
      // 获取基础权限
      const basicPermissions = await this.permissionRepository.find({
        where: [
          { name: 'article:read' },
          { name: 'article:create' },
          { name: 'article:update' },
          { name: 'article:delete' },
          { name: 'comment:read' },
          { name: 'comment:create' },
          { name: 'comment:update' },
          { name: 'comment:delete' },
          { name: 'category:read' },
          { name: 'tag:read' },
          { name: 'user:read' },
          { name: 'user:update' },
        ],
      });

      // 创建普通用户角色
      const createRoleDto: CreateRoleDto = {
        name: this.USER_ROLE_NAME,
        description: '普通用户，拥有基础权限',
        permissionIds: basicPermissions.map(p => p.id),
      };

      userRole = await this.create(createRoleDto);
    }
  }

  /**
   * 创建角色
   */
  async create(createRoleDto: CreateRoleDto): Promise<Role> {
    const { permissionIds, ...roleData } = createRoleDto;

    // 创建角色实体
    const role = this.roleRepository.create(roleData);

    // 如果指定了权限ID，关联权限
    if (permissionIds && permissionIds.length > 0) {
      const permissions = await this.permissionRepository.find({
        where: { id: In(permissionIds) },
      });
      role.permissions = permissions;
    }

    return await this.save(role);
  }

  /**
   * 查询所有角色（不分页）
   */
  async findAllRoles(): Promise<Role[]> {
    return await this.findBy({
      relations: ['permissions'],
      order: {
        id: 'ASC',
      },
    });
  }

  /**
   * 根据ID查询角色详情
   */
  async findOne(id: number): Promise<Role> {
    return await super.findOne(id, {
      relations: ['permissions'],
    });
  }

  /**
   * 更新角色
   */
  async update(id: number, updateRoleDto: UpdateRoleDto): Promise<Role> {
    const { permissionIds, ...roleData } = updateRoleDto;
    const role = await this.findOne(id);

    // 更新权限关联
    if (permissionIds !== undefined) {
      const permissions = await this.permissionRepository.find({
        where: { id: In(permissionIds) },
      });
      role.permissions = permissions;
    }

    // 更新其他字段
    Object.assign(role, roleData);
    return await this.save(role);
  }

  /**
   * 删除角色
   */
  async removeRole(id: number): Promise<{ success: boolean }> {
    await super.remove(id);
    return { success: true };
  }

  /**
   * 根据名称查找角色
   */
  async findByName(name: string): Promise<Role | null> {
    return await this.findOneBy({
      where: { name },
      relations: ['permissions'],
    });
  }

  /**
   * 批量查找角色
   */
  async findByIds(ids: number[]): Promise<Role[]> {
    return await this.findBy({
      where: { id: In(ids) },
      relations: ['permissions'],
    });
  }

  /**
   * 获取角色的权限列表
   */
  async getRolePermissions(id: number): Promise<Permission[]> {
    const role = await this.findOne(id);
    return role.permissions || [];
  }

  /**
   * 为角色添加权限
   */
  async addPermissions(id: number, permissionIds: number[]): Promise<Role> {
    const role = await this.findOne(id);
    const newPermissions = await this.permissionRepository.find({
      where: { id: In(permissionIds) },
    });

    // 合并现有权限和新权限，去重
    const existingPermissionIds = role.permissions.map(p => p.id);
    const permissionsToAdd = newPermissions.filter(p => !existingPermissionIds.includes(p.id));

    role.permissions = [...role.permissions, ...permissionsToAdd];
    return await this.save(role);
  }

  /**
   * 移除角色的权限
   */
  async removePermissions(id: number, permissionIds: number[]): Promise<Role> {
    const role = await this.findOne(id);
    role.permissions = role.permissions.filter(p => !permissionIds.includes(p.id));
    return await this.save(role);
  }

  /**
   * 检查角色是否有指定权限
   */
  async hasPermission(id: number, permissionName: string): Promise<boolean> {
    const role = await this.findOne(id);
    return role.permissions.some(p => p.name === permissionName);
  }
}
