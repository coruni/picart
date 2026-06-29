import { TypeOrmModuleOptions } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import * as path from "path";

export const databaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => ({
  type: "mysql",
  host: configService.get("DB_HOST") || "localhost",
  port: parseInt(configService.get("DB_PORT") || "3306"),
  username: configService.get("DB_USERNAME") || "root",
  password: configService.get("DB_PASSWORD") || "",
  database: configService.get("DB_DATABASE") || "nest_db",
  entities: [path.join(__dirname, "../**/*.entity{.ts,.js}")],
  autoLoadEntities: true,
  insecureAuth: true,
  synchronize: configService.get("DB_SYNC") || false,
  logging: configService.get("DB_LOGGING") || false,
  // 数据库连接池配置
  extra: {
    // 最大连接数（建议为 CPU 核心数 * 2 + 磁盘数）
    connectionLimit: parseInt(configService.get("DB_CONNECTION_LIMIT") || "25"),
    // 获取连接超时时间（毫秒）
    acquireTimeout: 60000,
    // 查询超时时间（毫秒）
    timeout: 60000,
    // 启用 keepAlive 保持连接活跃
    enableKeepAlive: true,
    // keepAlive 间隔（毫秒）
    keepAliveInitialDelay: 30000,
  },
  // 连接池预热选项
  poolSize: parseInt(configService.get("DB_POOL_SIZE") || "10"),
});
