import { JwtModuleOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { SignOptions } from 'jsonwebtoken';

export const jwtConfig = (configService: ConfigService): JwtModuleOptions => ({
  secret: configService.get<string>('JWT_SECRET', 'your-secret-key'),
  signOptions: {
    expiresIn: configService.get<string>('JWT_EXPIRES_IN', '24h') as any,
  },
});

export const jwtRefreshConfig = (configService: ConfigService): JwtModuleOptions => ({
  secret: configService.get<string>('JWT_REFRESH_SECRET', 'your-refresh-secret-key'),
  signOptions: {
    expiresIn: configService.get<string>('JWT_REFRESH_EXPIRES_IN', '30d') as any,
  },
});
