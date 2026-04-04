import { ConfigService } from "@nestjs/config";
import { LoggerUtil } from "./logger.util";

export class ConfigUtil {
  /**
   * 检查 JWT 相关配置
   * @param configService 配置服务
   */
  static checkJwtConfig(configService: ConfigService): void {
    const jwtSecret = configService.get<string>("JWT_SECRET");
    const jwtExpiresIn = configService.get<string>("JWT_EXPIRES_IN");
    const jwtRefreshSecret = configService.get<string>("JWT_REFRESH_SECRET");
    const jwtRefreshExpiresIn = configService.get<string>(
      "JWT_REFRESH_EXPIRES_IN",
    );
  }

  /**
   * 检查缓存相关配置
   * @param configService 配置服务
   */
  static checkCacheConfig(configService: ConfigService): void {
    const useRedis = configService.get<boolean>("USE_REDIS");
    const redisUrl = configService.get<string>("REDIS_URL");
    const cacheTtl = configService.get<number>("CACHE_TTL");
    const cacheMax = configService.get<number>("CACHE_MAX");
  }

  /**
   * 检查数据库配置
   * @param configService 配置服务
   */
  static checkDatabaseConfig(configService: ConfigService): void {
    const dbHost = configService.get<string>("DB_HOST");
    const dbPort = configService.get<number>("DB_PORT");
    const dbDatabase = configService.get<string>("DB_DATABASE");
    const dbUsername = configService.get<string>("DB_USERNAME");
  }

  /**
   * 检查所有关键配置
   * @param configService 配置服务
   */
  static checkAllConfig(configService: ConfigService): void {
    LoggerUtil.info("🔍 开始检查应用配置...", "ConfigUtil");

    this.checkJwtConfig(configService);
    this.checkCacheConfig(configService);
    this.checkDatabaseConfig(configService);

    LoggerUtil.info("✅ 配置检查完成", "ConfigUtil");
  }
}
