import { Injectable, NotFoundException, ForbiddenException, UnauthorizedException, Inject } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In } from 'typeorm';
import { Role } from '../role/entities/role.entity';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { JwtUtil, PermissionUtil } from 'src/common/utils';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UserService {

  private jwtUtil: JwtUtil;

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    this.jwtUtil = new JwtUtil(jwtService, configService, cacheManager);
  }

  async validateUser(username: string, password: string): Promise<Omit<User, 'password'> | null> {
    const user = await this.findOneByUsername(username);
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('密码错误');
    }

    const { password: _, ...safeUser } = user;
    // 处理手机号
    if (safeUser.phone) {
      safeUser.phone = safeUser.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
    }
    // 处理邮箱
    if (safeUser.email) {
      const [name, domain] = safeUser.email.split('@');
      safeUser.email = `${name[0]}****@${domain}`;
    }
    return safeUser;
  }

  async login(user: Omit<User, 'password'>) {
    const payload = { username: user.username, sub: user.id };
    const { accessToken, refreshToken } = await this.jwtUtil.generateTokens(payload);

    // 检查缓存中是否有 token
    if (this.cacheManager) {
      const cachedToken = await this.cacheManager.get(`user:${user.id}:token`);
      const cachedRefresh = await this.cacheManager.get(`user:${user.id}:refresh`);
      if (cachedToken) {
        // 登录后缓存中存在 accessToken: 与新 token 一致
      } else {
        // 登录后缓存中不存在 accessToken
      }
      if (cachedRefresh) {
        // 登录后缓存中存在 refreshToken
      } else {
        // 登录后缓存中不存在 refreshToken
      }
    }

    // 保存 refreshToken
    await this.userRepository.update(user.id, {
      lastLoginAt: new Date(),
      refreshToken,
    });

    return {
      ...user,
      token: accessToken,
      refreshToken,
    };
  }

  private async findOneByUsername(username: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { username },

      relations: ['roles', 'roles.permissions'],
    });
  }

  async create(createUserDto: CreateUserDto, currentUser?: User) {
    const { password, roleIds, ...userData } = createUserDto;
    const hashedPassword = await bcrypt.hash(password, 10);

    // 检查是否是第一个用户（注册场景）
    const userCount = await this.userRepository.count();
    let roles;

    if (userCount === 0) {
      // 如果是第一个用户，赋予超级管理员角色
      const superAdminRole = await this.roleRepository.findOne({
        where: { name: 'super-admin' },
      });
      if (!superAdminRole) {
        throw new Error('超级管理员角色不存在');
      }
      roles = [superAdminRole];
    } else {
      // 如果有当前用户（管理员创建用户）
      if (currentUser) {
        // 检查权限：只有超级管理员可以指定角色
        const isSuperAdmin = PermissionUtil.hasPermission(currentUser, 'user:manage') && 
                           currentUser.roles.some(role => role.name === 'super-admin');
        
        if (roleIds && roleIds.length > 0) {
          if (!isSuperAdmin) {
            throw new ForbiddenException('只有超级管理员可以指定用户角色');
          }
          // 超级管理员可以指定角色
          roles = await this.roleRepository.find({ where: { id: In(roleIds) } });
        } else {
          // 默认赋予普通用户角色
          const userRole = await this.roleRepository.findOne({
            where: { name: 'user' },
          });
          if (!userRole) {
            throw new Error('普通用户角色不存在');
          }
          roles = [userRole];
        }
      } else {
        // 普通注册，默认赋予普通用户角色
        const userRole = await this.roleRepository.findOne({
          where: { name: 'user' },
        });
        if (!userRole) {
          throw new Error('普通用户角色不存在');
        }
        roles = [userRole];
      }
    }

    const user = this.userRepository.create({
      ...userData,
      password: hashedPassword,
      roles,
    });

    const savedUser = await this.userRepository.save(user);
    
    if (currentUser) {
      // 用户创建用户
    } else {
      // 用户注册
    }

    return savedUser;
  }

  async findAll(pagination: PaginationDto, username?: string) {
    const { page, limit } = pagination;
    const [users, total] = await this.userRepository.findAndCount({
      where: {
        username: username ? Like(`%${username}%`) : undefined,
      },
      relations: ['roles', 'roles.permissions'],
      select: {
        id: true,
        username: true,
        nickname: true,
        avatar: true,
        email: true,
        phone: true,
        status: true,
        roles: {
          id: true,
          name: true,
          description: true,
          permissions: {
            id: true,
            name: true,
            description: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number) {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['roles', 'roles.permissions'],
      select: {
        id: true,
        username: true,
        nickname: true,
        avatar: true,
        email: true,
        phone: true,
        status: true,
        roles: {
          id: true,
          name: true,
          description: true,
          permissions: {
            id: true,
            name: true,
            description: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`用户不存在`);
    }

    return user;
  }

  async update(id: number, updateUserDto: UpdateUserDto, currentUser: User) {
    const { roleIds, ...userData } = updateUserDto;
    const user = await this.findOne(id);

    // 检查权限：如果不是更新自己的信息，需要管理员权限
    if (currentUser.id !== id && !PermissionUtil.hasPermission(currentUser, 'user:manage')) {
      throw new ForbiddenException('您没有权限修改其他用户的信息');
    }

    // 如果普通用户尝试修改自己的信息，只允许修改特定字段
    if (currentUser.id === id && !PermissionUtil.hasPermission(currentUser, 'user:manage')) {
      const allowedFields = ['nickname', 'avatar', 'birthday', 'gender', 'address', 'description'];
      Object.keys(userData).forEach(key => {
        if (!allowedFields.includes(key)) {
          delete userData[key];
        }
      });
    }

    // 更新角色
    if (roleIds) {
      const roles = await this.roleRepository.find({ where: { id: In(roleIds) } });
      user.roles = roles;
    }

    // 更新其他字段
    Object.assign(user, userData);

    const updatedUser = await this.userRepository.save(user);

    return updatedUser;
  }

  async remove(id: number, currentUser: User) {
    const user = await this.findOne(id);

    // 检查权限：只有管理员可以删除用户
    if (!PermissionUtil.hasPermission(currentUser, 'user:manage')) {
      throw new ForbiddenException('您没有权限删除用户');
    }

    const result = await this.userRepository.remove(user);
    
    return { success: true, data: result };
  }

  async refreshToken(refreshToken: string) {
    const user = await this.userRepository.findOne({ where: { refreshToken } });
    if (!user) throw new UnauthorizedException('无效的刷新令牌');
    try {
      this.jwtUtil.verifyToken(refreshToken);
    } catch {
      throw new UnauthorizedException('刷新令牌已过期');
    }
    const payload = { username: user.username, sub: user.id };
    const accessToken = await this.jwtUtil.generateAccessToken(payload);
    return { token: accessToken };
  }

  async logout(userId: number) {
    await this.userRepository.update(userId, { refreshToken: undefined });
    await this.jwtUtil.clearUserTokens(userId);
    return { success: true };
  }
}
