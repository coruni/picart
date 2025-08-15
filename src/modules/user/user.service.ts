import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  UnauthorizedException,
  Inject,
  BadRequestException,
} from "@nestjs/common";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { User } from "./entities/user.entity";
import { UserDevice } from "./entities/user-device.entity";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Like, In, FindManyOptions, FindOptionsSelect, FindOptionsWhere } from "typeorm";
import { Role } from "../role/entities/role.entity";
import { PaginationDto } from "src/common/dto/pagination.dto";
import { JwtUtil, PermissionUtil, sanitizeUser } from "src/common/utils";
import { Cache } from "cache-manager";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { ConfigService } from "@nestjs/config";
import { ListUtil } from "src/common/utils";
import { ConfigService as AppConfigService } from "../config/config.service";
import { Invite } from "../invite/entities/invite.entity";
import { MailerService } from "../../common/services/mailer.service";
import { TooManyRequestException } from "../../common/exceptions/too-many-request.exception";

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

  async validateUser(
    account: string,
    password: string,
  ): Promise<Omit<User, "password"> | null> {
    // 判断是邮箱还是用户名
    const isEmail = account.includes("@");
    let user: User | null;

    if (isEmail) {
      user = await this.findOneByEmail(account);
    } else {
      user = await this.findOneByUsername(account);
    }

    if (!user) {
      throw new NotFoundException("用户不存在");
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new BadRequestException("密码错误");
    }

    const { password: _password, ...safeUser } = user;
    // 处理手机号
    if (safeUser.phone) {
      safeUser.phone = safeUser.phone.replace(
        /(\d{3})\d{4}(\d{4})/,
        "$1****$2",
      );
    }
    // 处理邮箱
    if (safeUser.email) {
      const [name, domain] = safeUser.email.split("@");
      safeUser.email = `${name[0]}****@${domain}`;
    }
    return safeUser;
  }

  async login(user: Omit<User, "password">, req: Request) {
    const deviceId = req.headers["device-id"] as string;
    const deviceName = req.headers["device-name"] as string | undefined;
    const deviceType = req.headers["device-type"] as string | undefined;
    const payload = { username: user.username, sub: user.id, deviceId };
    const { accessToken, refreshToken } =
      await this.jwtUtil.generateTokens(payload);

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
        },
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
      relations: ["roles", "roles.permissions", "config"],
    });
  }

  private async findOneByEmail(email: string) {
    return this.userRepository.findOne({
      where: { email },
      relations: ["roles", "roles.permissions", "config"],
    });
  }

  getUserRepository() {
    return this.userRepository;
  }

  async create(
    createUserDto: CreateUserDto,
    currentUser?: User,
    req?: Request,
  ) {
    const { password, roleIds, inviteCode, verificationCode, ...userData } =
      createUserDto;

    // 查询用户名或者邮箱是否存在
    let searchUser = await this.findOneByUsername(userData.username);
    if (searchUser) {
      throw new BadRequestException("response.error.usernameAlreadyExists");
    }
    if (userData.email) {
      searchUser = await this.findOneByEmail(userData.email);
      if (searchUser) {
        throw new BadRequestException("response.error.emailAlreadyExists");
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const isEmailVerificationEnabled =
      await this.appConfigService.getEmailVerificationEnabled();
    // 检查是否是第一个用户（注册场景）
    const userCount = await this.userRepository.count();
    let roles;
    let inviterId: number | null = null;

    if (userCount === 0) {
      // 如果是第一个用户，赋予超级管理员角色
      const superAdminRole = await this.roleRepository.findOne({
        where: { name: "super-admin" },
      });
      if (!superAdminRole) {
        throw new Error("response.error.superAdminRoleNotExist");
      }
      roles = [superAdminRole];
    } else {
      // 如果有当前用户（管理员创建用户）
      if (currentUser) {
        // 检查权限：只有超级管理员可以指定角色
        const isSuperAdmin =
          PermissionUtil.hasPermission(currentUser, "user:manage") &&
          currentUser.roles.some((role) => role.name === "super-admin");

        if (roleIds && roleIds.length > 0) {
          if (!isSuperAdmin) {
            throw new ForbiddenException(
              "response.error.onlySuperAdminCanSpecifyRole",
            );
          }
          // 超级管理员可以指定角色
          roles = await this.roleRepository.find({
            where: { id: In(roleIds) },
          });
        } else {
          // 默认赋予普通用户角色
          const userRole = await this.roleRepository.findOne({
            where: { name: "user" },
          });
          if (!userRole) {
            throw new Error("response.error.userRoleNotExist");
          }
          roles = [userRole];
        }
      } else {
        // 普通注册，处理邀请码逻辑
        await this.validateInviteCode(inviteCode);

        // 如果启用了邮箱验证，必须提供验证码
        if (isEmailVerificationEnabled && !verificationCode) {
          throw new BadRequestException(
            "response.error.emailVerificationCodeRequired",
          );
        }

        // 如果提供了验证码，验证其有效性
        if (isEmailVerificationEnabled && verificationCode) {
          await this.verifyCode(
            userData.email!,
            verificationCode,
            "verification",
          );
        }
        // 如果有邀请码，获取邀请者ID（邀请码已在validateInviteCode中验证）
        if (inviteCode) {
          const invite = await this.inviteRepository.findOne({
            where: { inviteCode, status: "PENDING" },
          });

          if (invite) {
            inviterId = invite.inviterId;
          }
        }

        // 默认赋予普通用户角色
        const userRole = await this.roleRepository.findOne({
          where: { name: "user" },
        });
        if (!userRole) {
          throw new NotFoundException("response.error.userRoleNotExist");
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

    const deviceId = req?.headers["device-id"] as string;
    const deviceName = req?.headers["device-name"] as string | undefined;
    const deviceType = req?.headers["device-type"] as string | undefined;

    if (deviceId) {
      await this.userDeviceRepository.save({
        userId: savedUser.id,
        deviceId,
        deviceName,
        deviceType,
      });
    }
    // 生成token

    const payload = {
      username: savedUser.username,
      sub: savedUser.id,
      deviceId: deviceId,
    };
    const { accessToken, refreshToken } =
      await this.jwtUtil.generateTokens(payload);

    // 排除password字段
    const { password: _password, ...safeUser } = savedUser;

    return {
      ...safeUser,
      token: accessToken,
      refreshToken,
    };
  }

  /**
   * 验证邀请码
   */
  private async validateInviteCode(inviteCode?: string) {
    // const isInviteCodeEnabled = await this.appConfigService.isInviteCodeEnabled();
    const isInviteCodeRequired =
      await this.appConfigService.isInviteCodeRequired();

    // 如果邀请码是必填的
    if (isInviteCodeRequired && !inviteCode) {
      throw new BadRequestException("response.error.inviteCodeRequired");
    }

    // 如果提供了邀请码，验证其有效性
    if (inviteCode) {
      const invite = await this.inviteRepository.findOne({
        where: { inviteCode },
      });

      if (!invite) {
        throw new BadRequestException("response.error.inviteCodeNotExist");
      }

      if (invite.status !== "PENDING") {
        throw new BadRequestException("response.error.inviteCodeUsed");
      }

      if (invite.expiredAt && invite.expiredAt < new Date()) {
        // 更新邀请码状态为过期
        await this.inviteRepository.update(invite.id, { status: "EXPIRED" });
        throw new BadRequestException("response.error.inviteCodeExpired");
      }
    }
  }

  /**
   * 更新邀请记录
   */
  private async updateInviteRecord(
    inviteCode: string,
    userId: number,
    inviterId: number,
  ) {
    // 更新邀请记录
    const invite = await this.inviteRepository.findOne({
      where: { inviteCode, status: "PENDING" },
    });

    if (invite) {
      invite.inviteeId = userId;
      invite.status = "USED";
      invite.usedAt = new Date();
      await this.inviteRepository.save(invite);

      // 更新邀请人的邀请数量
      await this.userRepository.increment({ id: inviterId }, "inviteCount", 1);
    }
  }

  async findAllUsers(pagination: PaginationDto, username?: string, currentUser?: User) {
    // 构建查询参数 管理员可以看到除了password的全部字
    const hasPermission = PermissionUtil.hasPermission(currentUser, 'user:manage')

    const { page, limit } = pagination;
    const whereCondition: FindOptionsWhere<User> = {
      ...(username && { username: Like(`%${username}%`) }),
    };

    const findOptions: FindManyOptions<User> = {
      where: whereCondition,
      relations: ["roles", "config"],
      select: hasPermission
        ? { password: false }
        : {
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
          roles: true,
          membershipLevel: true,
          membershipStatus: true,
          createdAt: true,
          updatedAt: true,
        },
      order: {
        createdAt: "DESC" as const,
      },
      skip: (page - 1) * limit,
      take: limit,
    };

    const [data, total] = await this.userRepository.findAndCount(findOptions);

    return ListUtil.fromFindAndCount([data, total], page, limit);
  }

  async findOneById(id: number) {
    return await this.userRepository.findOne({
      where: { id },
      relations: ["roles", "roles.permissions", "config"],
    })
  }


  async findOne(id: number, currentUser: User) {

    // 构建查询参数 管理员可以看到除了password的全部字
    const hasPermission = PermissionUtil.hasPermission(currentUser, 'user:manage')

    const user = await this.userRepository.findOne({
      where: { id },
      relations: ["roles", "roles.permissions", "config"],
      select: hasPermission
        ? { password: false }
        : {
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
          roles: true,
          membershipLevel: true,
          membershipStatus: true,
          createdAt: true,
          updatedAt: true,
        }
    });

    if (!user) {
      throw new NotFoundException("response.error.userNotExist");
    }

    return user;
  }

  async updateUser(
    id: number,
    updateUserDto: UpdateUserDto,
    currentUser: User,
  ) {
    const { roleIds, ...userData } = updateUserDto;
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ["roles"],
    });
    if (!user) {
      throw new NotFoundException("response.error.userNotExist");
    }

    // 检查权限：如果不是更新自己的信息，需要管理员权限
    if (
      currentUser.id !== id &&
      !PermissionUtil.hasPermission(currentUser, "user:manage")
    ) {
      throw new ForbiddenException("response.error.userNoPermission");
    }

    // 如果普通用户尝试修改自己的信息，只允许修改特定字段
    if (
      currentUser.id === id &&
      !PermissionUtil.hasPermission(currentUser, "user:manage")
    ) {
      const allowedFields = [
        "nickname",
        "avatar",
        "birthday",
        "gender",
        "address",
        "description",
      ];
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

  async removeUser(
    id: number,
    currentUser: User,
  ) {
    const user = await this.userRepository.findOneBy({ id });
    if (!user) {
      throw new NotFoundException("response.error.userNotExist");
    }
    // 检查权限：只有管理员可以删除用户
    if (!PermissionUtil.hasPermission(currentUser, "user:manage")) {
      throw new ForbiddenException("response.error.userNoPermission");
    }

    await this.userRepository.remove(user);

    return { success: true, message: "response.success.userDelete" };

  }

  async refreshToken(refreshToken: string, deviceId: string) {
    // 查找 user_device 表
    const device = await this.userDeviceRepository.findOne({
      where: { refreshToken },
    });
    if (!device)
      throw new UnauthorizedException("response.error.refreshTokenInvalid");
    // 校验 token
    try {
      this.jwtUtil.verifyToken(refreshToken);
    } catch {
      throw new UnauthorizedException("response.error.refreshTokenExpired");
    }
    // 查找用户
    const user = await this.userRepository.findOne({
      where: { id: device.userId },
    });
    if (!user) throw new UnauthorizedException("response.error.userNotExist");
    const payload = { username: user.username, sub: user.id, deviceId };
    const accessToken = await this.jwtUtil.generateAccessToken(payload);
    // 更新活跃时间
    await this.userDeviceRepository.update(device.id, {
      lastActiveAt: new Date(),
    });
    return { token: accessToken };
  }

  async logout(userId: number, deviceId: string) {
    // 删除 user_device 记录
    await this.userDeviceRepository.delete({ userId, deviceId });
    if (this.cacheManager) {
      await this.cacheManager.del(`user:${userId}:device:${deviceId}:token`);
      await this.cacheManager.del(`user:${userId}:device:${deviceId}:refresh`);
    }
    return { success: true };
  }

  /**
   * 关注用户
   */
  async follow(currentUserId: number, targetUserId: number) {
    if (currentUserId === targetUserId)
      throw new ForbiddenException("response.error.followSelf");
    const currentUser = await this.userRepository.findOne({
      where: { id: currentUserId },
      relations: ["following"],
    });
    const targetUser = await this.userRepository.findOne({
      where: { id: targetUserId },
      relations: ["followers"],
    });
    if (!currentUser || !targetUser)
      throw new NotFoundException("response.error.userNotExist");
    if (currentUser.following.some((u) => u.id === targetUserId))
      throw new ForbiddenException("response.error.followed");
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
    if (currentUserId === targetUserId)
      throw new ForbiddenException("response.error.unfollowSelf");
    const currentUser = await this.userRepository.findOne({
      where: { id: currentUserId },
      relations: ["following"],
    });
    const targetUser = await this.userRepository.findOne({
      where: { id: targetUserId },
      relations: ["followers"],
    });
    if (!currentUser || !targetUser)
      throw new NotFoundException("response.error.userNotExist");
    if (!currentUser.following.some((u) => u.id === targetUserId))
      throw new ForbiddenException("response.error.unfollowed");
    currentUser.following = currentUser.following.filter(
      (u) => u.id !== targetUserId,
    );
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
    if (!user) throw new NotFoundException("response.error.userNotExist");
    return { followerCount: user.followerCount };
  }

  /**
   * 获取关注数量
   */
  async getFollowingCount(userId: number) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException("response.error.userNotExist");
    return { followingCount: user.followingCount };
  }

  /**
   * 获取粉丝列表
   */
  async getFollowers(userId: number, pagination: PaginationDto) {
    // 先验证用户是否存在
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException("response.error.userNotExist");

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
        createdAt: "DESC" as const,
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
    if (!user) throw new NotFoundException("response.error.userNotExist");

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
        createdAt: "DESC" as const,
      },
      skip: (page - 1) * limit,
      take: limit,
    };

    const [data, total] = await this.userRepository.findAndCount(findOptions);

    return ListUtil.fromFindAndCount([data, total], page, limit);
  }

  /**
   * 检查用户是否关注了指定用户
   */
  async isFollowing(userId: number, targetUserId: number) {
    const count = await this.userRepository.count({
      where: {
        id: targetUserId,
        followers: { id: userId },
      },
    });
    return count > 0;
  }

  async getProfile(userId: number): Promise<Omit<User, "password">> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ["roles", "roles.permissions", "config"],
    });
    if (!user) {
      throw new NotFoundException("response.error.userNotExist");
    }
    //处理手机号 邮箱 地址等信息
    if (user && user.phone) {
      user.phone = user.phone.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2");
    }
    if (user && user.email) {
      const [name, domain] = user.email.split("@");
      user.email = `${name[0]}****@${domain}`;
    }

    const { password, ...safeUser } = user;
    return safeUser;
  }

  async rechargeWallet(userId: number, amount: number, paymentMethod: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException("response.error.userNotExist");
  }

  async withdrawWallet(userId: number, amount: number, bankInfo: any) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException("response.error.userNotExist");
    user.wallet -= amount;
    await this.userRepository.save(user);
    return { success: true, wallet: user.wallet };
  }

  /**
   * 发送邮箱验证码（通用接口）
   * @param email 邮箱地址
   * @param type 验证码类型：'verification' | 'reset_password'，默认为 'verification'
   */
  async sendVerificationCode(email: string, type: string = "verification") {
    // 检查用户是否存在（重置密码时需要验证用户存在）
    if (type === "reset_password") {
      const user = await this.findOneByEmail(email);
      if (!user) {
        throw new NotFoundException("response.error.userNotExist");
      }
    }

    // 防止频繁发送
    const cacheKey = `send_verification_code:${email}:${type}`;
    const existSended = await this.cacheManager.get<boolean>(cacheKey);
    if (existSended) {
      throw new TooManyRequestException("response.error.tooManyRequests");
    } else {
      await this.cacheManager.set(cacheKey, "true", 1000 * 60); // 1分钟内不能重复发送
    }

    // 生成6位数字验证码
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // 根据类型设置不同的缓存键和有效期
    const codeCacheKey =
      type === "reset_password"
        ? `reset_password_code:${email}`
        : `verification_code:${email}`;

    const expiration =
      type === "reset_password"
        ? 1000 * 60 * 10 // 重置密码验证码10分钟有效期
        : 1000 * 60 * 10; // 普通验证码10分钟有效期

    await this.cacheManager.set(codeCacheKey, code, expiration);

    // 根据类型发送不同的邮件
    if (type === "reset_password") {
      await this.mailerService.sendResetPassword(email, code);
      return {
        success: true,
        message: "response.success.resetPasswordEmailSent",
      };
    } else {
      await this.mailerService.sendVerificationCode(email, code);
      return {
        success: true,
        message: "response.success.verificationCodeSent",
      };
    }
  }

  /**
   * 验证验证码（内部方法）
   * @param email 邮箱地址
   * @param code 验证码
   * @param type 验证码类型：'verification' | 'reset_password'，默认为 'verification'
   */
  private async verifyCode(
    email: string,
    code: string,
    type: string = "verification",
  ) {
    // 检查用户是否存在（重置密码时需要验证用户存在）
    if (type === "reset_password") {
      const user = await this.findOneByEmail(email);
      if (!user) {
        throw new NotFoundException("response.error.userNotExist");
      }
    }

    // 根据类型获取对应的缓存键
    const codeCacheKey =
      type === "reset_password"
        ? `reset_password_code:${email}`
        : `verification_code:${email}`;

    // 验证验证码
    const storedCode = await this.cacheManager.get<string>(codeCacheKey);
    if (!storedCode) {
      throw new BadRequestException("response.error.verificationCodeExpired");
    }

    if (storedCode !== code) {
      throw new BadRequestException("response.error.verificationCodeError");
    }

    // 验证码正确，清除缓存
    await this.cacheManager.del(codeCacheKey);

    return {
      success: true,
      message: "response.success.verificationCodeSuccess",
    };
  }

  /**
   * 重置密码
   */
  async resetPassword(email: string, code: string, newPassword: string) {
    // 检查用户是否存在
    const user = await this.findOneByEmail(email);
    if (!user) {
      throw new NotFoundException("response.error.userNotExist");
    }

    // 验证重置密码验证码
    const codeCacheKey = `reset_password_code:${email}`;
    const storedCode = await this.cacheManager.get<string>(codeCacheKey);
    if (!storedCode) {
      throw new BadRequestException("response.error.verificationCodeExpired");
    }

    if (storedCode !== code) {
      throw new BadRequestException("response.error.verificationCodeError");
    }

    // 验证新密码格式
    if (newPassword.length < 6) {
      throw new BadRequestException("response.error.passwordLengthError");
    }

    // 加密新密码
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // 更新用户密码
    user.password = hashedPassword;
    await this.userRepository.save(user);

    // 验证码正确，清除缓存
    await this.cacheManager.del(codeCacheKey);

    return {
      success: true,
      message: "response.success.passwordResetSuccess",
    };
  }

  /**
   * 修改密码（需要原密码）
   */
  async changePassword(
    userId: number,
    oldPassword: string,
    newPassword: string,
  ) {
    // 获取用户信息
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("response.error.userNotExist");
    }

    // 验证原密码
    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isOldPasswordValid) {
      throw new BadRequestException("response.error.oldPasswordError");
    }

    // 验证新密码格式
    if (newPassword.length < 6) {
      throw new BadRequestException("response.error.passwordLengthError");
    }

    // 检查新密码是否与原密码相同
    if (oldPassword === newPassword) {
      throw new BadRequestException("response.error.newPasswordSame");
    }

    // 加密新密码
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // 更新用户密码
    user.password = hashedPassword;
    await this.userRepository.save(user);

    return {
      success: true,
      message: "response.success.passwordChangeSuccess",
    };
  }
}
