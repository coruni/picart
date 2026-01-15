import { Injectable, UnauthorizedException, Inject, ForbiddenException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { User } from '../entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { LoggerUtil } from '../../../common/utils/logger.util';
import { Request } from 'express';

type JwtPayload = {
  sub: number;
  username: string;
  deviceId: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    const secret = configService.get<string>('JWT_SECRET', 'your-secret-key');
    super({
      jwtFromRequest: (req) => {
        // 1. 如果是 WebSocket 握手请求，从握手信息中提取
        if (req.handshake?.headers?.authorization) {
          return ExtractJwt.fromAuthHeaderAsBearerToken()({
            headers: { authorization: req.handshake.headers.authorization },
          });
        }
        // 2. 普通 HTTP 请求
        return ExtractJwt.fromAuthHeaderAsBearerToken()(req);
      },
      ignoreExpiration: false,
      secretOrKey: secret,
      passReqToCallback: true,
    });
  }

  async validate(req: Request | any, payload: JwtPayload): Promise<User> {
    // 兼容 WebSocket 和 HTTP 的 deviceId 获取
    const deviceId = req.handshake?.headers?.['device-id'] || req.headers?.['device-id'];

    try {
      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
        relations: ['roles', 'roles.permissions'],
      });

      if (!user) throw new UnauthorizedException('response.error.userNotExist');

      // 检查用户是否被封禁
      if (user.status === 'BANNED') {
        throw new ForbiddenException(
          user.banReason 
            ? `账号已被封禁：${user.banReason}` 
            : '账号已被封禁'
        );
      }

      // Token 黑名单检查
      const cacheKey = `user:${payload.sub}:device:${deviceId}:token`;
      const cachedToken = await this.cacheManager.get(cacheKey);
      if (!cachedToken) {
        throw new UnauthorizedException('response.error.tokenInvalid');
      }

      return user;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      LoggerUtil.error('JWT验证异常', error, 'JwtStrategy');
      throw new UnauthorizedException('response.error.tokenInvalid');
    }
  }
}
