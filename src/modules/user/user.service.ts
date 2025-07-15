import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  UnauthorizedException,
  Inject,
  BadRequestException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { UserDevice } from './entities/user-device.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In, FindManyOptions } from 'typeorm';
import { Role } from '../role/entities/role.entity';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { JwtUtil, PermissionUtil, sanitizeUser } from 'src/common/utils';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { ListUtil } from 'src/common/utils';
import { ConfigService as AppConfigService } from '../config/config.service';
import { Invite } from '../invite/entities/invite.entity';
import { MailerService } from '../../common/services/mailer.service';
import { TooManyRequestException } from '../../common/exceptions/too-many-request.exception';

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
    @InjectRepository(Invite)
    private inviteRepository: Repository<Invite>,
    @InjectRepository(UserDevice)
    private userDeviceRepository: Repository<UserDevice>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private appConfigService: AppConfigService,
    private mailerService: MailerService,
  ) {
    this.jwtUtil = new JwtUtil(jwtService, configService, cacheManager);
  }

  async validateUser(username: string, password: string): Promise<Omit<User, 'password'> | null> {
    const user = await this.findOneByUsername(username);
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new BadRequestException('密码错误');
    }

    const { password: _password, ...safeUser } = user;
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

  async login(user: Omit<User, 'password'>, req: Request) {
    const deviceId = req.headers['device-id'] as string;
    const deviceName = req.headers['device-name'] as string | undefined;
    const deviceType = req.headers['device-type'] as string | undefined;
    const payload = { username: user.username, sub: user.id, deviceId };
    const { accessToken, refreshToken } = await this.jwtUtil.generateTokens(payload);

    // 保存设备信息和 refreshToken 到 user_device 表
    // 先查找是否已存在该用户和设备的记录，存在则更新，不存在则创建
    const existingDevice = await this.userDeviceRepository.findOne({
      where: { userId: user.id, deviceId },
    });

    if (existingDevice) {
      await this.userDeviceRepository.update(
        { userId: user.id, deviceId },
        {
          deviceType,
          deviceName,
          refreshToken,
          loginAt: new Date(),
          lastActiveAt: new Date(),
        }
      );
    } else {
      await this.userDeviceRepository.save({
        userId: user.id,
        deviceId,
        deviceType,
        deviceName,
        refreshToken,
        loginAt: new Date(),
        lastActiveAt: new Date(),
      });
    }
    await this.userRepository.update(user.id, { lastLoginAt: new Date() });

    return {
      ...user,
      token: accessToken,
      refreshToken,
    };
  }

  private async findOneByUsername(username: string) {
    return this.userRepository.findOne({
      where: { username },

      relations: ['roles', 'roles.permissions'],
    });
  }

  async create(createUserDto: CreateUserDto, currentUser?: User) {
    const { password, roleIds, inviteCode, verificationCode, ...userData } = createUserDto;
    const hashedPassword = await bcrypt.hash(password, 10);
    const isEmailVerificationEnabled = await this.cacheManager.get('user_email_verification');
    // 检查是否是第一个用户（注册场景）
    const userCount = await this.userRepository.count();
    let roles;
    let inviterId: number | null = null;

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
        const isSuperAdmin =
          PermissionUtil.hasPermission(currentUser, 'user:manage') &&
          currentUser.roles.some((role) => role.name === 'super-admin');

        if (roleIds && roleIds.length > 0) {
          if (!isSuperAdmin) {
            throw new ForbiddenException('只有超级管理员可以指定用户角色');
          }
          // 超级管理员可以指定角色
          roles = await this.roleRepository.find({
            where: { id: In(roleIds) },
          });
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
        // 普通注册，处理邀请码逻辑
        await this.validateInviteCode(inviteCode);
        if (isEmailVerificationEnabled && !verificationCode) {
          throw new BadRequestException('邮箱验证码不能为空');
        }

        if (isEmailVerificationEnabled && verificationCode) {
          await this.validateVerificationCode(userData.email!, verificationCode);
        }
        // 如果有邀请码，验证并获取邀请者ID
        if (inviteCode) {
          const invite = await this.inviteRepository.findOne({
            where: { inviteCode, status: 'PENDING' },
          });

          if (invite) {
            // 检查邀请码是否过期
            if (invite.expiredAt && invite.expiredAt < new Date()) {
              throw new BadRequestException('邀请码已过期');
            }
            inviterId = invite.inviterId;
          }
        }

        // 默认赋予普通用户角色
        const userRole = await this.roleRepository.findOne({
          where: { name: 'user' },
        });
        if (!userRole) {
          throw new NotFoundException('普通用户角色不存在');
        }
        roles = [userRole];
      }
    }

    const user = this.userRepository.create({
      ...userData,
      password: hashedPassword,
      roles,
      inviterId,
      inviteCode: inviteCode || null,
    });

    const savedUser = await this.userRepository.save(user);

    // 如果使用了邀请码，更新邀请记录
    if (inviteCode && inviterId) {
      await this.updateInviteRecord(inviteCode, savedUser.id, inviterId);
    }

    return savedUser;
  }

  /**
   * 验证邀请码
   */
  private async validateInviteCode(inviteCode?: string) {
    // const isInviteCodeEnabled = await this.appConfigService.isInviteCodeEnabled();
    const isInviteCodeRequired = await this.appConfigService.isInviteCodeRequired();

    // 如果邀请码是必填的
    if (isInviteCodeRequired && !inviteCode) {
      throw new BadRequestException('注册需要邀请码');
    }

    // 如果提供了邀请码，验证其有效性
    if (inviteCode) {
      const invite = await this.inviteRepository.findOne({
        where: { inviteCode },
      });

      if (!invite) {
        throw new BadRequestException('邀请码不存在');
      }

      if (invite.status !== 'PENDING') {
        throw new BadRequestException('邀请码已失效');
      }

      if (invite.expiredAt && invite.expiredAt < new Date()) {
        // 更新邀请码状态为过期
        await this.inviteRepository.update(invite.id, { status: 'EXPIRED' });
        throw new BadRequestException('邀请码已过期');
      }
    }
  }

  /**
   * 更新邀请记录
   */
  private async updateInviteRecord(inviteCode: string, userId: number, inviterId: number) {
    // 更新邀请记录
    const invite = await this.inviteRepository.findOne({
      where: { inviteCode, status: 'PENDING' },
    });

    if (invite) {
      invite.inviteeId = userId;
      invite.status = 'USED';
      invite.usedAt = new Date();
      await this.inviteRepository.save(invite);

      // 更新邀请人的邀请数量
      await this.userRepository.increment({ id: inviterId }, 'inviteCount', 1);
    }
  }

  async findAllUsers(pagination: PaginationDto, username?: string) {
    const { page, limit } = pagination;
    const whereCondition: any = {};

    if (username) {
      whereCondition.username = Like(`%${username}%`);
    }

    const findOptions: FindManyOptions<User> = {
      where: whereCondition,
      relations: ['roles', 'config'],
      select: {
        id: true,
        username: true,
        nickname: true,
        avatar: true,
        description: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
      order: {
        createdAt: 'DESC' as const,
      },
      skip: (page - 1) * limit,
      take: limit,
    };

    const [data, total] = await this.userRepository.findAndCount(findOptions);

    return ListUtil.fromFindAndCount([data, total], page, limit);
  }

  async findOne(id: number) {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['roles', 'roles.permissions', 'config'],
      select: {
        id: true,
        username: true,
        nickname: true,
        avatar: true,
        description: true,
        status: true,
        followerCount: true,
        followingCount: true,
        wallet: true,
        score: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`用户不存在`);
    }

    return user;
  }

  async updateUser(id: number, updateUserDto: UpdateUserDto, currentUser: User) {
    const { roleIds, ...userData } = updateUserDto;
    const user = await this.findOne(id);

    // 检查权限：如果不是更新自己的信息，需要管理员权限
    if (currentUser.id !== id && !PermissionUtil.hasPermission(currentUser, 'user:manage')) {
      throw new ForbiddenException('您没有权限修改其他用户的信息');
    }

    // 如果普通用户尝试修改自己的信息，只允许修改特定字段
    if (currentUser.id === id && !PermissionUtil.hasPermission(currentUser, 'user:manage')) {
      const allowedFields = ['nickname', 'avatar', 'birthday', 'gender', 'address', 'description'];
      Object.keys(userData).forEach((key) => {
        if (!allowedFields.includes(key)) {
          delete userData[key];
        }
      });
    }

    // 更新角色
    if (roleIds) {
      const roles = await this.roleRepository.find({
        where: { id: In(roleIds) },
      });
      user.roles = roles;
    }

    // 更新其他字段
    Object.assign(user, userData);

    return await this.userRepository.save(user);
  }

  async removeUser(id: number, currentUser: User): Promise<{ success: boolean }> {
    const user = await this.findOne(id);

    // 检查权限：只有管理员可以删除用户
    if (!PermissionUtil.hasPermission(currentUser, 'user:manage')) {
      throw new ForbiddenException('您没有权限删除用户');
    }

    await this.userRepository.remove(user);

    return { success: true };
  }

  async refreshToken(refreshToken: string, deviceId: string) {
    // 查找 user_device 表
    const device = await this.userDeviceRepository.findOne({ where: { refreshToken } });
    if (!device) throw new UnauthorizedException('无效的刷新令牌');
    // 校验 token
    try {
      this.jwtUtil.verifyToken(refreshToken);
    } catch {
      throw new UnauthorizedException('刷新令牌已过期');
    }
    // 查找用户
    const user = await this.userRepository.findOne({ where: { id: device.userId } });
    if (!user) throw new UnauthorizedException('用户不存在');
    const payload = { username: user.username, sub: user.id, deviceId };
    const accessToken = await this.jwtUtil.generateAccessToken(payload);
    // 更新活跃时间
    await this.userDeviceRepository.update(device.id, { lastActiveAt: new Date() });
    return { token: accessToken };
  }

  async logout(userId: number, deviceId: string) {
    // 删除 user_device 记录
    await this.userDeviceRepository.delete({ userId, deviceId });
    if (this.cacheManager) {
      await this.cacheManager.del(`user:${userId}:device:${deviceId}:token`)
      await this.cacheManager.del(`user:${userId}:device:${deviceId}:refresh`);
    }
    return { success: true };
  }

  /**
   * 关注用户
   */
  async follow(currentUserId: number, targetUserId: number) {
    if (currentUserId === targetUserId) throw new ForbiddenException('不能关注自己');
    const currentUser = await this.userRepository.findOne({
      where: { id: currentUserId },
      relations: ['following'],
    });
    const targetUser = await this.userRepository.findOne({
      where: { id: targetUserId },
      relations: ['followers'],
    });
    if (!currentUser || !targetUser) throw new NotFoundException('用户不存在');
    if (currentUser.following.some((u) => u.id === targetUserId))
      throw new ForbiddenException('已关注该用户');
    currentUser.following.push(targetUser);
    targetUser.followerCount++;
    currentUser.followingCount++;
    await this.userRepository.save([currentUser, targetUser]);
    return { success: true };
  }

  /**
   * 取关用户
   */
  async unfollow(currentUserId: number, targetUserId: number) {
    if (currentUserId === targetUserId) throw new ForbiddenException('不能取关自己');
    const currentUser = await this.userRepository.findOne({
      where: { id: currentUserId },
      relations: ['following'],
    });
    const targetUser = await this.userRepository.findOne({
      where: { id: targetUserId },
      relations: ['followers'],
    });
    if (!currentUser || !targetUser) throw new NotFoundException('用户不存在');
    if (!currentUser.following.some((u) => u.id === targetUserId))
      throw new ForbiddenException('未关注该用户');
    currentUser.following = currentUser.following.filter((u) => u.id !== targetUserId);
    targetUser.followerCount = Math.max(0, targetUser.followerCount - 1);
    currentUser.followingCount = Math.max(0, currentUser.followingCount - 1);
    await this.userRepository.save([currentUser, targetUser]);
    return { success: true };
  }

  /**
   * 获取粉丝数量
   */
  async getFollowerCount(userId: number) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('用户不存在');
    return { followerCount: user.followerCount };
  }

  /**
   * 获取关注数量
   */
  async getFollowingCount(userId: number) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('用户不存在');
    return { followingCount: user.followingCount };
  }

  /**
   * 获取粉丝列表
   */
  async getFollowers(userId: number, pagination: PaginationDto) {
    // 先验证用户是否存在
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('用户不存在');

    const { page, limit } = pagination;

    const findOptions: FindManyOptions<User> = {
      where: { following: { id: userId } },
      select: {
        id: true,
        username: true,
        nickname: true,
        description: true,
        avatar: true,
        status: true,
        createdAt: true,
      },
      order: {
        createdAt: 'DESC' as const,
      },
      skip: (page - 1) * limit,
      take: limit,
    };

    const [data, total] = await this.userRepository.findAndCount(findOptions);

    return ListUtil.fromFindAndCount([data, total], page, limit);
  }

  /**
   * 获取关注列表
   */
  async getFollowings(userId: number, pagination: PaginationDto) {
    // 先验证用户是否存在
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('用户不存在');

    const { page, limit } = pagination;

    const findOptions: FindManyOptions<User> = {
      where: { followers: { id: userId } },
      select: {
        id: true,
        username: true,
        nickname: true,
        description: true,
        avatar: true,
        status: true,
        createdAt: true,
      },
      order: {
        createdAt: 'DESC' as const,
      },
      skip: (page - 1) * limit,
      take: limit,
    };

    const [data, total] = await this.userRepository.findAndCount(findOptions);

    return ListUtil.fromFindAndCount([data, total], page, limit);
  }

  async getProfile(userId: number) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['roles', 'roles.permissions', 'config'],
      select: {
        id: true,
        username: true,
        nickname: true,
        avatar: true,
        email: true,
        address: true,
        phone: true,
        status: true,
        followerCount: true,
        followingCount: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    //处理手机号 邮箱 地址等信息
    if (user && user.phone) {
      user.phone = user.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
    }

    if (user && user.email) {
      const [name, domain] = user.email.split('@');
      user.email = `${name[0]}****@${domain}`;
    }
    return user;
  }

  async rechargeWallet(userId: number, amount: number, paymentMethod: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('用户不存在');
  }

  async withdrawWallet(userId: number, amount: number, bankInfo: any) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('用户不存在');
    user.wallet -= amount;
    await this.userRepository.save(user);
    return { success: true, wallet: user.wallet };
  }

  async sendVerificationCode(email: string) {
    // 是否已发送
    const existSended = await this.cacheManager.get<boolean>(`send_verification_code:${email}`);
    if (existSended) {
      throw new TooManyRequestException('请等待60秒后重新获取');
    } else {
      await this.cacheManager.set(`send_verification_code:${email}`, 'true', 1000 * 60);
    }
    const code = Math.floor(100000 + Math.random() * 900000);
    await this.cacheManager.set(`verification_code:${email}`, code, 1000 * 60 * 10);
    await this.mailerService.sendVerificationCode(email, code);
    return { success: true };
  }

  private async validateVerificationCode(email: string, verificationCode: string) {
    const code = await this.cacheManager.get(`verification_code:${email}`);
    if (!code) throw new BadRequestException('验证码不存在');
    if (code !== verificationCode) throw new BadRequestException('验证码错误');
    await this.cacheManager.del(`verification_code:${email}`);
    return true;
  }
}
