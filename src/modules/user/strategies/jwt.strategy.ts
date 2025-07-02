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

type JwtPayload = {
  sub: number;
  username: string;
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
    });
    LoggerUtil.info(`JwtStrategy 初始化完成，secret: ${secret ? '已设置' : '未设置'}`, 'JwtStrategy');
    LoggerUtil.info(`JwtStrategy secret 值: ${secret}`, 'JwtStrategy');
  }

  async validate(payload: JwtPayload): Promise<User> {
    LoggerUtil.info(`JwtStrategy.validate payload: ${JSON.stringify(payload)}`, 'JwtStrategy');
    const cachedToken = await this.cacheManager.get(`user:${payload.sub}:token`);
    LoggerUtil.info(`JwtStrategy.validate 缓存中的 token: ${cachedToken ? '存在' : '不存在'}`, 'JwtStrategy');
    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
      relations: ['roles', 'roles.permissions'],
    });
    LoggerUtil.info(`JwtStrategy.validate user: ${user ? JSON.stringify({id: user.id, username: user.username}) : 'null'}`, 'JwtStrategy');
    if (!cachedToken) {
      LoggerUtil.warn(`用户 ${payload.sub} 的 token 已失效`, 'JwtStrategy');
      throw new UnauthorizedException('Token已失效');
    }
    if (!user) {
      LoggerUtil.warn(`用户 ${payload.sub} 不存在`, 'JwtStrategy');
      throw new UnauthorizedException('用户不存在');
    }
    LoggerUtil.info(`JWT 策略验证成功: 用户 ${user.username}`, 'JwtStrategy');
    return user;
  }
}
