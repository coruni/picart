import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "../user/entities/user.entity";
import { UserService } from "../user/user.service";

export interface UserPresencePayload {
  userId: number;
  isOnline: boolean;
  lastSeenAt: string | null;
}

@Injectable()
export class MessagePresenceService {
  private readonly userSockets = new Map<number, Set<string>>();
  private readonly socketUsers = new Map<string, number>();

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly userService: UserService,
  ) {}

  getPresenceRoom(userId: number) {
    return `presence:user:${userId}`;
  }

  async handleConnected(userId: number, socketId: string, deviceId?: string) {
    const sockets = this.userSockets.get(userId) ?? new Set<string>();
    const wasOffline = sockets.size === 0;

    sockets.add(socketId);
    this.userSockets.set(userId, sockets);
    this.socketUsers.set(socketId, userId);

    const lastSeenAt = await this.userService.touchUserActivity(userId, deviceId);

    return {
      becameOnline: wasOffline,
      payload: this.createPayload(userId, true, lastSeenAt),
    };
  }

  async handleDisconnected(socketId: string) {
    const userId = this.socketUsers.get(socketId);
    if (!userId) {
      return null;
    }

    this.socketUsers.delete(socketId);

    const sockets = this.userSockets.get(userId);
    if (!sockets) {
      return null;
    }

    sockets.delete(socketId);
    if (sockets.size > 0) {
      return null;
    }

    this.userSockets.delete(userId);
    const lastSeenAt = await this.userService.touchUserActivity(userId);

    return {
      becameOffline: true,
      payload: this.createPayload(userId, false, lastSeenAt),
    };
  }

  async touchOnlineUser(userId: number, deviceId?: string) {
    if (!this.isUserOnline(userId)) {
      return null;
    }

    const lastSeenAt = await this.userService.touchUserActivity(userId, deviceId);
    return this.createPayload(userId, true, lastSeenAt);
  }

  isUserOnline(userId: number) {
    return (this.userSockets.get(userId)?.size ?? 0) > 0;
  }

  async getUserPresence(userId: number): Promise<UserPresencePayload> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: {
        id: true,
        lastActiveAt: true,
      },
    });

    return {
      userId,
      isOnline: this.isUserOnline(userId),
      lastSeenAt: user?.lastActiveAt ? user.lastActiveAt.toISOString() : null,
    };
  }

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
