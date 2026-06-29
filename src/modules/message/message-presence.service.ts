import { Injectable, Inject, forwardRef, OnModuleDestroy } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "../user/entities/user.entity";
import { UserService } from "../user/user.service";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";

export interface UserPresencePayload {
  userId: number;
  isOnline: boolean;
  lastSeenAt: string | null;
}

/**
 * 用户在线状态服务 - Redis 实现
 *
 * 使用 Redis 存储在线状态的优势：
 * 1. 支持多实例部署，状态共享
 * 2. 服务重启后自动清理（TTL 过期）
 * 3. 避免内存泄漏
 * 4. 自动处理僵尸连接
 */
@Injectable()
export class MessagePresenceService implements OnModuleDestroy {
  private readonly PRESENCE_KEY_PREFIX = "presence:user:";
  private readonly SOCKET_USER_PREFIX = "presence:socket:";
  private readonly PRESENCE_TTL = 300; // 5 分钟 TTL，用于自动清理僵尸连接

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  /**
   * 模块销毁时清理资源
   */
  async onModuleDestroy() {
    // 可选：在模块销毁时执行清理逻辑
  }

  /**
   * 获取用户专属的房间名称
   */
  getPresenceRoom(userId: number) {
    return `presence:user:${userId}`;
  }

  /**
   * 生成 Redis 存储键
   */
  private getUserPresenceKey(userId: number): string {
    return `${this.PRESENCE_KEY_PREFIX}${userId}`;
  }

  private getSocketUserKey(socketId: string): string {
    return `${this.SOCKET_USER_PREFIX}${socketId}`;
  }

  /**
   * 处理用户连接
   */
  async handleConnected(userId: number, socketId: string, deviceId?: string) {
    const userPresenceKey = this.getUserPresenceKey(userId);
    const socketUserKey = this.getSocketUserKey(socketId);

    // 获取用户当前的 socket 连接集合
    const socketsStr = await this.cacheManager.get<string>(userPresenceKey);
    const sockets = socketsStr ? new Set<string>(socketsStr.split(',')) : new Set<string>();
    const wasOffline = sockets.size === 0;

    // 添加新的 socket 连接
    sockets.add(socketId);
    await this.cacheManager.set(
      userPresenceKey,
      Array.from(sockets).join(','),
      this.PRESENCE_TTL * 1000, // TTL 毫秒
    );

    // 记录 socket -> userId 映射
    await this.cacheManager.set(
      socketUserKey,
      String(userId),
      this.PRESENCE_TTL * 1000,
    );

    // 更新用户活跃时间
    const lastSeenAt = await this.userService.touchUserActivity(
      userId,
      deviceId,
    );

    return {
      becameOnline: wasOffline,
      payload: this.createPayload(userId, true, lastSeenAt),
    };
  }

  /**
   * 处理用户断开连接
   */
  async handleDisconnected(socketId: string) {
    const socketUserKey = this.getSocketUserKey(socketId);
    const userIdStr = await this.cacheManager.get<string>(socketUserKey);

    if (!userIdStr) {
      return null;
    }

    const userId = parseInt(userIdStr, 10);

    // 删除 socket -> userId 映射
    await this.cacheManager.del(socketUserKey);

    // 从用户的 socket 集合中移除
    const userPresenceKey = this.getUserPresenceKey(userId);
    const socketsStr = await this.cacheManager.get<string>(userPresenceKey);

    if (!socketsStr) {
      return null;
    }

    const sockets = new Set<string>(socketsStr.split(','));
    sockets.delete(socketId);

    if (sockets.size > 0) {
      // 用户还有其他连接，更新集合
      await this.cacheManager.set(
        userPresenceKey,
        Array.from(sockets).join(','),
        this.PRESENCE_TTL * 1000,
      );
      return null;
    }

    // 用户所有连接已断开
    await this.cacheManager.del(userPresenceKey);
    const lastSeenAt = await this.userService.touchUserActivity(userId);

    return {
      becameOffline: true,
      payload: this.createPayload(userId, false, lastSeenAt),
    };
  }

  /**
   * 刷新在线用户的心跳
   */
  async touchOnlineUser(userId: number, deviceId?: string) {
    const isOnline = await this.isUserOnline(userId);
    if (!isOnline) {
      return null;
    }

    // 刷新 TTL
    const userPresenceKey = this.getUserPresenceKey(userId);
    const socketsStr = await this.cacheManager.get<string>(userPresenceKey);
    if (socketsStr) {
      await this.cacheManager.set(
        userPresenceKey,
        socketsStr,
        this.PRESENCE_TTL * 1000,
      );
    }

    const lastSeenAt = await this.userService.touchUserActivity(
      userId,
      deviceId,
    );
    return this.createPayload(userId, true, lastSeenAt);
  }

  /**
   * 检查用户是否在线
   */
  async isUserOnline(userId: number): Promise<boolean> {
    const userPresenceKey = this.getUserPresenceKey(userId);
    const socketsStr = await this.cacheManager.get<string>(userPresenceKey);
    if (!socketsStr) {
      return false;
    }

    const sockets = socketsStr.split(',').filter(s => s.length > 0);
    return sockets.length > 0;
  }

  /**
   * 获取用户在线状态
   */
  async getUserPresence(userId: number): Promise<UserPresencePayload> {
    const [user, isOnline] = await Promise.all([
      this.userRepository.findOne({
        where: { id: userId },
        select: {
          id: true,
          lastActiveAt: true,
        },
      }),
      this.isUserOnline(userId),
    ]);

    return {
      userId,
      isOnline,
      lastSeenAt: user?.lastActiveAt ? user.lastActiveAt.toISOString() : null,
    };
  }

  /**
   * 创建状态载荷
   */
  private createPayload(
    userId: number,
    isOnline: boolean,
    lastSeenAt: Date,
  ): UserPresencePayload {
    return {
      userId,
      isOnline,
      lastSeenAt: lastSeenAt.toISOString(),
    };
  }
}
