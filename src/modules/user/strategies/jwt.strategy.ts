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
  private static readonly AUTH_USER_CACHE_PREFIX = "auth:user:";
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

  private getAuthUserCacheKey(userId: number) {
    return `${JwtStrategy.AUTH_USER_CACHE_PREFIX}${userId}:permissions`;
  }

  private async getCachedAuthUser(userId: number): Promise<User | null> {
    const cachedUser = await this.cacheManager.get<User>(
      this.getAuthUserCacheKey(userId),
    );
    return cachedUser || null;
  }

  private async setCachedAuthUser(user: User) {
    await this.cacheManager.set(
      this.getAuthUserCacheKey(user.id),
      user,
      this.authUserCacheTtl,
    );
  }

  private async loadAuthUser(userId: number): Promise<User> {
    const cachedUser = await this.getCachedAuthUser(userId);
    if (cachedUser) {
      return cachedUser;
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ["roles", "roles.permissions"],
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
      const tokenCacheKey = `user:${payload.sub}:device:${deviceId}:token`;
      const cachedToken = await this.cacheManager.get(tokenCacheKey);
      if (!cachedToken) {
        throw new UnauthorizedException("response.error.tokenInvalid");
      }

      const user = await this.loadAuthUser(payload.sub);

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
