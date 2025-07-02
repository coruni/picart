import { ConfigService } from '@nestjs/config';
import { LoggerUtil } from './logger.util';

export class ConfigUtil {
  /**
   * 检查 JWT 相关配置
   * @param configService 配置服务
   */
  static checkJwtConfig(configService: ConfigService): void {
    const jwtSecret = configService.get<string>('JWT_SECRET');
    const jwtExpiresIn = configService.get<string>('JWT_EXPIRES_IN');
    const jwtRefreshSecret = configService.get<string>('JWT_REFRESH_SECRET');
    const jwtRefreshExpiresIn = configService.get<string>('JWT_REFRESH_EXPIRES_IN');

    LoggerUtil.info('=== JWT 配置检查 ===', 'ConfigUtil');
    LoggerUtil.info(`JWT_SECRET: ${jwtSecret ? '已设置' : '未设置'}`, 'ConfigUtil');
    LoggerUtil.info(`JWT_EXPIRES_IN: ${jwtExpiresIn || '使用默认值 24h'}`, 'ConfigUtil');
    LoggerUtil.info(`JWT_REFRESH_SECRET: ${jwtRefreshSecret ? '已设置' : '未设置'}`, 'ConfigUtil');
    LoggerUtil.info(`JWT_REFRESH_EXPIRES_IN: ${jwtRefreshExpiresIn || '使用默认值 30d'}`, 'ConfigUtil');
  }

  /**
   * 检查缓存相关配置
   * @param configService 配置服务
   */
  static checkCacheConfig(configService: ConfigService): void {
    const useRedis = configService.get<boolean>('USE_REDIS');
    const redisUrl = configService.get<string>('REDIS_URL');
    const cacheTtl = configService.get<number>('CACHE_TTL');
    const cacheMax = configService.get<number>('CACHE_MAX');

    LoggerUtil.info('=== 缓存配置检查 ===', 'ConfigUtil');
    LoggerUtil.info(`USE_REDIS: ${useRedis}`, 'ConfigUtil');
    LoggerUtil.info(`REDIS_URL: ${redisUrl || '未设置'}`, 'ConfigUtil');
    LoggerUtil.info(`CACHE_TTL: ${cacheTtl || '使用默认值 3600'}`, 'ConfigUtil');
    LoggerUtil.info(`CACHE_MAX: ${cacheMax || '使用默认值 1000'}`, 'ConfigUtil');
  }

  /**
   * 检查数据库配置
   * @param configService 配置服务
   */
  static checkDatabaseConfig(configService: ConfigService): void {
    const dbHost = configService.get<string>('DB_HOST');
    const dbPort = configService.get<number>('DB_PORT');
    const dbDatabase = configService.get<string>('DB_DATABASE');
    const dbUsername = configService.get<string>('DB_USERNAME');

    LoggerUtil.info('=== 数据库配置检查 ===', 'ConfigUtil');
    LoggerUtil.info(`DB_HOST: ${dbHost || '未设置'}`, 'ConfigUtil');
    LoggerUtil.info(`DB_PORT: ${dbPort || '未设置'}`, 'ConfigUtil');
    LoggerUtil.info(`DB_DATABASE: ${dbDatabase || '未设置'}`, 'ConfigUtil');
    LoggerUtil.info(`DB_USERNAME: ${dbUsername || '未设置'}`, 'ConfigUtil');
  }

  /**
   * 检查所有关键配置
   * @param configService 配置服务
   */
  static checkAllConfig(configService: ConfigService): void {
    LoggerUtil.info('🔍 开始检查应用配置...', 'ConfigUtil');
    
    this.checkJwtConfig(configService);
    this.checkCacheConfig(configService);
    this.checkDatabaseConfig(configService);
    
    LoggerUtil.info('✅ 配置检查完成', 'ConfigUtil');
  }
} 