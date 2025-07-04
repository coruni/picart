import { Injectable, OnModuleInit } from '@nestjs/common';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission } from './entities/permission.entity';

@Injectable()
export class PermissionService implements OnModuleInit {
  private readonly defaultPermissions = [
    // 用户管理权限
    { name: 'user:create', description: '创建用户' },
    { name: 'user:read', description: '查看用户' },
    { name: 'user:update', description: '更新用户' },
    { name: 'user:delete', description: '删除用户' },
    { name: 'user:manage', description: '管理用户（管理员权限）' },
    { name: 'user:profile', description: '管理个人资料' },

    // 文章管理权限
    { name: 'article:create', description: '创建文章' },
    { name: 'article:read', description: '查看文章' },
    { name: 'article:update', description: '更新文章' },
    { name: 'article:delete', description: '删除文章' },
    { name: 'article:manage', description: '管理所有文章（管理员权限）' },

    // 分类管理权限
    { name: 'category:create', description: '创建分类' },
    { name: 'category:read', description: '查看分类' },
    { name: 'category:update', description: '更新分类' },
    { name: 'category:delete', description: '删除分类' },
    { name: 'category:manage', description: '管理所有分类（管理员权限）' },

    // 评论管理权限
    { name: 'comment:create', description: '创建评论' },
    { name: 'comment:read', description: '查看评论' },
    { name: 'comment:update', description: '更新评论' },
    { name: 'comment:delete', description: '删除评论' },
    { name: 'comment:manage', description: '管理所有评论（管理员权限）' },

    // 标签管理权限
    { name: 'tag:create', description: '创建标签' },
    { name: 'tag:read', description: '查看标签' },
    { name: 'tag:update', description: '更新标签' },
    { name: 'tag:delete', description: '删除标签' },
    { name: 'tag:manage', description: '管理所有标签（管理员权限）' },

    // 角色管理权限
    { name: 'role:create', description: '创建角色' },
    { name: 'role:read', description: '查看角色' },
    { name: 'role:update', description: '更新角色' },
    { name: 'role:delete', description: '删除角色' },
    { name: 'role:manage', description: '管理所有角色（管理员权限）' },

    // 权限管理权限
    { name: 'permission:create', description: '创建权限' },
    { name: 'permission:read', description: '查看权限' },
    { name: 'permission:update', description: '更新权限' },
    { name: 'permission:delete', description: '删除权限' },
    { name: 'permission:manage', description: '管理所有权限（管理员权限）' },

    // 系统设置权限
    { name: 'setting:create', description: '创建设置' },
    { name: 'setting:read', description: '查看设置' },
    { name: 'setting:update', description: '更新设置' },
    { name: 'setting:delete', description: '删除设置' },
    { name: 'setting:manage', description: '管理系统设置（管理员权限）' },

    // 系统管理权限
    { name: 'system:manage', description: '系统管理（超级管理员权限）' },
    { name: 'system:monitor', description: '系统监控' },
    { name: 'system:log', description: '查看系统日志' },
  ];

  public initPromise: Promise<void>;

  constructor(
    @InjectRepository(Permission)
    private permissionRepository: Repository<Permission>,
  ) {
    this.initPromise = Promise.resolve();
  }

  async onModuleInit() {
    this.initPromise = this.initializePermissions();
    await this.initPromise;
  }

  private async initializePermissions() {
    const existingPermissions = await this.permissionRepository.find();

    if (existingPermissions.length === 0) {
      // 如果没有权限，直接创建所有默认权限
      await this.permissionRepository.save(this.defaultPermissions);
    } else {
      // 检查并添加缺失的权限
      await this.syncPermissions();
    }
  }

  private async syncPermissions() {
    const existingPermissions = await this.permissionRepository.find();
    const existingPermissionNames = existingPermissions.map(p => p.name);

    // 找出缺失的权限
    const missingPermissions = this.defaultPermissions.filter(
      permission => !existingPermissionNames.includes(permission.name),
    );

    if (missingPermissions.length > 0) {
      // 添加缺失的权限
      await this.permissionRepository.save(missingPermissions);
    }
  }

  async findAll() {
    return this.permissionRepository.find();
  }

  async findOne(id: number) {
    return this.permissionRepository.findOne({ where: { id } });
  }

  async create(createPermissionDto: CreatePermissionDto) {
    const permission = this.permissionRepository.create(createPermissionDto);
    return this.permissionRepository.save(permission);
  }

  async update(id: number, updatePermissionDto: UpdatePermissionDto) {
    await this.permissionRepository.update(id, updatePermissionDto);
    return this.findOne(id);
  }

  async remove(id: number) {
    const permission = await this.findOne(id);
    if (permission) {
      await this.permissionRepository.remove(permission);
    }
    return { success: true };
  }
}
