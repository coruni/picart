import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { Role } from './entities/role.entity';
import { Permission } from '../permission/entities/permission.entity';
import { PermissionService } from '../permission/permission.service';

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
  ) { }

  async onModuleInit() {
    await this.permissionService.initPromise;
    await this.initializeRoles();
  }

  private async initializeRoles() {
    await this.initializeSuperAdmin();
    await this.initializeUserRole();
  }

  private async initializeSuperAdmin() {
    // 检查是否已存在超级管理员角色
    let superAdminRole = await this.roleRepository.findOne({
      where: { name: this.SUPER_ADMIN_ROLE_NAME },
      relations: ['permissions'],
    });

    if (!superAdminRole) {
      // 获取所有权限
      const allPermissions = await this.permissionRepository.find();

      // 创建超级管理员角色
      superAdminRole = this.roleRepository.create({
        name: this.SUPER_ADMIN_ROLE_NAME,
        displayName: this.SUPER_ADMIN_ROLE_DISPLAY_NAME,
        description: '超级管理员，拥有所有权限',
        permissions: allPermissions,
      });

      await this.roleRepository.save(superAdminRole);
    }
  }

  private async initializeUserRole() {
    // 检查是否已存在普通用户角色
    let userRole = await this.roleRepository.findOne({
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
          { name: 'user:update' }
        ],
      });

      // 创建普通用户角色
      userRole = this.roleRepository.create({
        name: this.USER_ROLE_NAME,
        displayName: this.USER_ROLE_DISPLAY_NAME,
        description: '普通用户，拥有基础权限',
        permissions: basicPermissions,
      });

      await this.roleRepository.save(userRole);
    }
  }

  async create(createRoleDto: CreateRoleDto) {
    const { permissionIds, ...roleData } = createRoleDto;
    const role = this.roleRepository.create(roleData);

    if (permissionIds && permissionIds.length > 0) {
      const permissions = await this.permissionRepository.find({ 
        where: { id: In(permissionIds) } 
      });
      role.permissions = permissions;
    }

    return this.roleRepository.save(role);
  }

  async findAll() {
    return this.roleRepository.find({
      relations: ['permissions'],
    });
  }

  async findOne(id: number) {
    const role = await this.roleRepository.findOne({
      where: { id },
      relations: ['permissions'],
    });

    if (!role) {
      throw new NotFoundException(`角色不存在`);
    }

    return role;
  }

  async update(id: number, updateRoleDto: UpdateRoleDto) {
    const { permissionIds, ...roleData } = updateRoleDto;
    const role = await this.findOne(id);

    if (permissionIds) {
      const permissions = await this.permissionRepository.find({ 
        where: { id: In(permissionIds) } 
      });
      role.permissions = permissions;
    }

    Object.assign(role, roleData);
    return this.roleRepository.save(role);
  }

  async remove(id: number) {
    const role = await this.findOne(id);
    await this.roleRepository.remove(role);
    return { success: true };
  }
}
