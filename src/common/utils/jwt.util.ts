import { JwtService } from '@nestjs/jwt';
import { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import { LoggerUtil } from './logger.util';

export interface JwtPayload {
  username: string;
  sub: number;
}

export interface TokenResult {
  accessToken: string;
  refreshToken: string;
}

export class JwtUtil {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private cacheManager?: Cache,
  ) {}

  /**
   * 生成 access token 和 refresh token
   * @param payload JWT 载荷
   * @returns TokenResult
   */
  async generateTokens(payload: JwtPayload): Promise<TokenResult> {
    const accessTokenExpiresIn = this.configService.get<string>('JWT_EXPIRES_IN', '24h');
    const refreshTokenExpiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '30d');

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: accessTokenExpiresIn,
    });
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: refreshTokenExpiresIn,
    });

    // 将 token 存储到缓存中，缓存时间与 token 过期时间保持一致
    if (this.cacheManager) {
      const accessTokenMs = this.parseTimeToMs(accessTokenExpiresIn);
      const refreshTokenMs = this.parseTimeToMs(refreshTokenExpiresIn);

      await this.cacheManager.set(`user:${payload.sub}:token`, accessToken, accessTokenMs);
      await this.cacheManager.set(`user:${payload.sub}:refresh`, refreshToken, refreshTokenMs);
    }

    return {
      accessToken,
      refreshToken,
    };
  }

  /**
   * 生成 access token
   * @param payload JWT 载荷
   * @returns string
   */
  async generateAccessToken(payload: JwtPayload): Promise<string> {
    const accessTokenExpiresIn = this.configService.get<string>('JWT_EXPIRES_IN', '24h');
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: accessTokenExpiresIn,
    });

    // 将 token 存储到缓存中，缓存时间与 token 过期时间保持一致
    if (this.cacheManager) {
      const accessTokenMs = this.parseTimeToMs(accessTokenExpiresIn);
      await this.cacheManager.set(`user:${payload.sub}:token`, accessToken, accessTokenMs);
    }

    return accessToken;
  }

  /**
   * 验证 token
   * @param token JWT token
   * @returns JwtPayload
   */
  verifyToken(token: string): JwtPayload {
    try {
      const payload = this.jwtService.verify(token);
      return payload;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      LoggerUtil.error(`JWT Token 验证失败: ${errorMessage}`, error, 'JwtUtil');
      throw error;
    }
  }

  /**
   * 清除用户的 token 缓存
   * @param userId 用户ID
   */
  async clearUserTokens(userId: number): Promise<void> {
    if (this.cacheManager) {
      await this.cacheManager.del(`user:${userId}:token`);
      await this.cacheManager.del(`user:${userId}:refresh`);
    }
  }

  /**
   * 将时间字符串解析为毫秒数
   * @param timeString 时间字符串 (如: '1h', '7d', '30d')
   * @returns 毫秒数
   */
  private parseTimeToMs(timeString: string): number {
    const unit = timeString.slice(-1);
    const value = parseInt(timeString.slice(0, -1), 10);
    switch (unit) {
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      default:
        return parseInt(timeString, 10) * 1000;
    }
  }
}
