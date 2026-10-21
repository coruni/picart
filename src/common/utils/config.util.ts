import { ConfigService } from "@nestjs/config";
import { LoggerUtil } from "./logger.util";

export class ConfigUtil {
  private static assertPresent(
    configService: ConfigService,
    keys: string[],
    label: string,
  ): void {
    const missing = keys.filter((key) => {
      const value = configService.get<string | number>(key);
      return value === undefined || value === null || value === "";
    });

    if (missing.length > 0) {
      throw new Error(`${label}缺少必要配置: ${missing.join(", ")}`);
    }
  }

  /**
   * 检查 JWT 相关配置
   */
  static checkJwtConfig(configService: ConfigService): void {
    this.assertPresent(configService, ["JWT_SECRET"], "JWT");
  }

  /**
   * 检查缓存相关配置
   */
  static checkCacheConfig(configService: ConfigService): void {
    const redisUrl = configService.get<string>("REDIS_URL");
    if (!redisUrl) {
      LoggerUtil.warn(
        "未配置 REDIS_URL，分布式缓存与队列将依赖默认 localhost:6379",
        "ConfigUtil",
      );
    }
  }

  /**
   * 检查数据库配置
   */
  static checkDatabaseConfig(configService: ConfigService): void {
    this.assertPresent(
      configService,
      ["DB_HOST", "DB_DATABASE", "DB_USERNAME"],
      "数据库",
    );
  }

  /**
   * 检查所有关键配置
   */
  static checkAllConfig(configService: ConfigService): void {
    this.checkJwtConfig(configService);
    this.checkCacheConfig(configService);
    this.checkDatabaseConfig(configService);
  }
}
