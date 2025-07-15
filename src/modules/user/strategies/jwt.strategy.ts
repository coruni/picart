import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
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
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
      passReqToCallback: true, // 关键
    });
  }

  async validate(req: Request, payload: JwtPayload): Promise<User> {
    const deviceId = req.headers['device-id'] as string;
    try {
      // 检查用户是否存在
      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
        relations: ['roles', 'roles.permissions'],
      });

      if (!user) {
        throw new UnauthorizedException('用户不存在');
      }

      // 检查缓存中的 token 是否存在（可选，用于token黑名单机制）
      const cachedToken = await this.cacheManager.get(
        `user:${payload.sub}:device:${deviceId}:token`,
      );
      if (!cachedToken) {
        // 如果缓存中没有token，可能是缓存过期或Redis连接问题
        // 这里可以选择是否严格要求缓存验证
        // LoggerUtil.warn(`用户 ${payload.sub} 的缓存token不存在`, 'JwtStrategy');
        // 暂时允许通过，只记录警告
        throw new UnauthorizedException('Token已失效');
      }

      return user;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      LoggerUtil.error('JWT验证异常', error, 'JwtStrategy');
      throw new UnauthorizedException('Token验证失败');
    }
  }
}
