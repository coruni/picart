import {
  Injectable,
  UnauthorizedException,
  Inject,
  ForbiddenException,
} from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { User } from "../entities/user.entity";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Cache } from "cache-manager";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { CacheKeys } from "../../../common/constants/cache-keys";
import { LoggerUtil } from "../../../common/utils/logger.util";
import { getHeaderValue } from "../../../common/utils/header.util";
import { Request } from "express";

type JwtPayload = {
  sub: number;
  username: string;
  deviceId: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly authUserCacheTtl: number;

  constructor(
    private configService: ConfigService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    const secret = configService.get<string>("JWT_SECRET", "your-secret-key");
    super({
      jwtFromRequest: (req) => {
        if (req.handshake?.headers?.authorization) {
          return ExtractJwt.fromAuthHeaderAsBearerToken()({
            headers: { authorization: req.handshake.headers.authorization },
          });
        }
        return ExtractJwt.fromAuthHeaderAsBearerToken()(req);
      },
      ignoreExpiration: false,
      secretOrKey: secret,
      passReqToCallback: true,
    });

    const authUserCacheTtl = Number(
      configService.get<string>("JWT_AUTH_USER_CACHE_TTL_MS", "60000"),
    );
    this.authUserCacheTtl =
      Number.isFinite(authUserCacheTtl) && authUserCacheTtl > 0
        ? authUserCacheTtl
        : 60000;
  }

  static getAuthUserCacheKey(userId: number) {
    return CacheKeys.authUser(userId);
  }

  private async setCachedAuthUser(user: User) {
    // 缓存里不保留密码哈希，避免 Redis 泄露即可拿到凭证
    delete (user as Partial<User>).password;
    await this.cacheManager.set(
      JwtStrategy.getAuthUserCacheKey(user.id),
      user,
      this.authUserCacheTtl,
    );
  }

  private async loadAuthUser(
    userId: number,
    cached?: User | null,
  ): Promise<User> {
    if (cached) {
      return cached;
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ["roles", "roles.permissions", "config"],
    });

    if (!user) {
      throw new UnauthorizedException("response.error.userNotExist");
    }

    await this.setCachedAuthUser(user);
    return user;
  }

  async validate(req: Request | any, payload: JwtPayload): Promise<User> {
    const deviceId =
      getHeaderValue(req.handshake?.headers, "device-id") ||
      getHeaderValue(req.headers, "device-id") ||
      payload.deviceId;

    try {
      const tokenCacheKey = CacheKeys.userDeviceToken(payload.sub, deviceId);
      const userCacheKey = JwtStrategy.getAuthUserCacheKey(payload.sub);

      // token 与用户快照并发读取，避免两次串行往返
      const [cachedToken, cachedUser] = await Promise.all([
        this.cacheManager.get<string>(tokenCacheKey),
        this.cacheManager.get<User>(userCacheKey),
      ]);

      if (!cachedToken) {
        throw new UnauthorizedException("response.error.tokenInvalid");
      }

      const user = await this.loadAuthUser(payload.sub, cachedUser ?? null);

      if (user.status === "BANNED") {
        throw new ForbiddenException(
          user.banReason ? `账号已被封禁：${user.banReason}` : "账号已被封禁",
        );
      }

      return user;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      LoggerUtil.error("JWT验证异常", error, "JwtStrategy");
      throw new UnauthorizedException("response.error.tokenInvalid");
    }
  }
}
