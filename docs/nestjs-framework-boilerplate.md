# NestJS 后端框架实现文档

从 picart 项目提炼的**通用框架层**（不含任何业务逻辑），用于同构项目的快速搭建。
本文档描述的每个部分都是可直接复制的框架定义，与业务无关。

- 技术栈基线：NestJS 11 + TypeScript 5.8
- 目标读者：要在同一套技术栈上另起项目的人
- 阅读顺序：第 1-2 章建立认知，第 3-6 章照做即可跑通骨架，第 7 章之后按需取用

---

## 1. 技术栈与依赖

### 1.1 分层依赖表

| 分层 | 依赖包 | 职责 |
|---|---|---|
| 框架内核 | `@nestjs/common` `@nestjs/core` `@nestjs/platform-express` `reflect-metadata` `rxjs` | Nest 运行时 |
| 配置 | `@nestjs/config` | 环境变量 + 配置工厂 |
| 数据库 | `typeorm` `@nestjs/typeorm` `mysql2` | ORM + MySQL 驱动 |
| 缓存 | `@nestjs/cache-manager` `cache-manager` `cacheable` `keyv` `@keyv/redis` | Redis + 内存双层缓存 |
| 队列 | `@nestjs/bull` `bull` | Redis 队列 |
| 认证 | `@nestjs/jwt` `@nestjs/passport` `passport` `passport-jwt` `jsonwebtoken` `bcrypt` | JWT 鉴权 |
| 校验 | `class-validator` `class-transformer` `@nestjs/mapped-types` | DTO 校验与转换 |
| 文档 | `@nestjs/swagger` `swagger-ui-express` | OpenAPI |
| 日志 | `nest-winston` `winston` `winston-daily-rotate-file` | 结构化日志 + 轮转 |
| 邮件 | `@nestjs-modules/mailer` `nodemailer` | 邮件发送 |
| 事件 | `@nestjs/event-emitter` | 进程内事件总线 |
| 上传 | `multer` `multer-s3` `@aws-sdk/client-s3` `@aws-sdk/lib-storage` `@aws-sdk/s3-request-presigner` `mime-types` `file-type-checker` | 文件上传（本地 / S3） |
| 图片 | `sharp` | 压缩、水印、缩放 |
| 视频 | `fluent-ffmpeg` `@mrkwskiti/fluent-ffmpeg-nestjs` | 转码、截图 |
| 搜索 | `@elastic/elasticsearch` `@nestjs/elasticsearch` | 全文检索（可选） |
| 安全 | `helmet` `compression` | 安全头 + Gzip |
| 实时 | `@nestjs/websockets` `@nestjs/platform-socket.io` `socket.io` | WebSocket |

### 1.2 安装

```bash
# 内核
pnpm add @nestjs/common @nestjs/core @nestjs/platform-express reflect-metadata rxjs

# 配置 / 数据库
pnpm add @nestjs/config typeorm @nestjs/typeorm mysql2

# 缓存 / 队列
pnpm add @nestjs/cache-manager cache-manager cacheable keyv @keyv/redis @nestjs/bull bull

# 认证
pnpm add @nestjs/jwt @nestjs/passport passport passport-jwt jsonwebtoken bcrypt

# 校验 / 文档
pnpm add class-validator class-transformer @nestjs/mapped-types @nestjs/swagger swagger-ui-express

# 日志 / 邮件 / 事件
pnpm add nest-winston winston winston-daily-rotate-file @nestjs-modules/mailer nodemailer @nestjs/event-emitter

# 上传 / 媒体
pnpm add multer multer-s3 @aws-sdk/client-s3 @aws-sdk/lib-storage @aws-sdk/s3-request-presigner mime-types file-type-checker sharp fluent-ffmpeg

# 安全 / 实时
pnpm add helmet compression @nestjs/websockets @nestjs/platform-socket.io socket.io

# 开发依赖
pnpm add -D @nestjs/cli @nestjs/schematics @nestjs/testing typescript ts-node tsconfig-paths
pnpm add -D @types/node @types/express @types/multer @types/multer-s3 @types/passport-jwt @types/bcrypt @types/jsonwebtoken @types/compression @types/helmet @types/mime-types @types/fluent-ffmpeg
pnpm add -D eslint prettier jest ts-jest @swc/core @swc/cli husky lint-staged
```

---

## 2. 目录结构约定

```
src/
├── main.ts                       # 引导：全局管线、静态资源、Swagger、启动自检
├── app.module.ts                 # 根模块：基础设施 forRoot + 全局守卫
├── app.controller.ts / app.service.ts
│
├── config/                       # 配置层：纯函数工厂，零副作用，可被任意模块 import
│   ├── index.ts                  # 统一出口
│   ├── database.config.ts
│   ├── cache.config.ts
│   ├── jwt.config.ts
│   ├── mailer.config.ts
│   ├── logger.config.ts
│   ├── swagger.config.ts
│   ├── validation.config.ts
│   ├── multer.config.ts
│   ├── upload.config.ts
│   ├── elasticsearch.config.ts
│   └── app.config.ts
│
├── common/                       # 通用层：与业务无关的横切关注点
│   ├── common.module.ts
│   ├── constants/index.ts
│   ├── decorators/               # @NoAuth @Permissions
│   ├── dto/                      # PaginationDto / BaseResponseDto
│   ├── exceptions/               # BusinessException 体系
│   ├── filters/                  # HttpExceptionFilter
│   ├── guards/                   # JwtAuthGuard / PermissionGuard
│   ├── interceptors/             # TransformInterceptor / LoggingInterceptor
│   ├── interfaces/               # 响应契约（interface 版）
│   ├── queue/                    # Bull 队列定义与 processor
│   ├── ffmpeg/                   # FFmpeg 封装模块
│   ├── services/                 # 通用服务（邮件等）
│   └── utils/                    # 无状态工具类
│
└── modules/                      # 业务模块
    └── <feature>/
        ├── <feature>.module.ts
        ├── <feature>.controller.ts
        ├── <feature>.service.ts
        ├── dto/
        └── entities/
```

### 分层铁律

1. `config/` 只能依赖 `@nestjs/*`，不得 import `common/` 或 `modules/`。
2. `common/` **不得 import `modules/`**（Entity、Service 都不行）。
   需要跨模块协作时，通过 `common.module.ts` 用 `TypeOrmModule.forFeature` 注册中性实体，
   或把依赖倒置成接口注入。
3. `modules/` 可以互相 import，也可以 import `common/` 与 `config/`。
4. 一个业务模块 = 一个目录，`entities/` 与 `dto/` 是子目录，不跨模块共享。

---

## 3. 配置层实现

### 3.1 `config/index.ts` 统一出口

```ts
export { databaseConfig } from "./database.config";
export { cacheConfig } from "./cache.config";
export { jwtConfig, jwtRefreshConfig } from "./jwt.config";
export { swaggerConfig } from "./swagger.config";
export { validationConfig } from "./validation.config";
export { loggerConfig } from "./logger.config";
export { multerConfig } from "./multer.config";
export { mailerConfig } from "./mailer.config";
export { appConfig } from "./app.config";
export { uploadConfig } from "./upload.config";
export { elasticsearchConfig, ELASTICSEARCH_INDEX } from "./elasticsearch.config";
```

### 3.2 `database.config.ts`

```ts
import { TypeOrmModuleOptions } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import * as path from "path";

export const databaseConfig = (configService: ConfigService): TypeOrmModuleOptions => ({
  type: "mysql",
  host: configService.get("DB_HOST") || "localhost",
  port: parseInt(configService.get("DB_PORT") || "3306", 10),
  username: configService.get("DB_USERNAME") || "root",
  password: configService.get("DB_PASSWORD") || "",
  database: configService.get("DB_DATABASE") || "nest_db",
  entities: [path.join(__dirname, "../**/*.entity{.ts,.js}")],
  autoLoadEntities: true,
  insecureAuth: true,
  synchronize: configService.get("DB_SYNC") === "true", // 生产必须 false
  logging: configService.get("DB_LOGGING") === "true",
  extra: {
    connectionLimit: parseInt(configService.get("DB_CONNECTION_LIMIT") || "25", 10),
    connectTimeout: 60000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 30000,
  },
  poolSize: parseInt(configService.get("DB_POOL_SIZE") || "10", 10),
});
```

**注意**：`mysql2` 驱动不认识 `acquireTimeout` / `timeout`，写了会打印
`Ignoring invalid configuration option passed to Connection` 警告。连接超时用 `connectTimeout`。

### 3.3 `cache.config.ts`（Redis + 内存双层）

```ts
import { createKeyv } from "cacheable";
import { createKeyv as createKeyvRedis } from "@keyv/redis";
import { ConfigService } from "@nestjs/config";
import { CacheModuleOptions } from "@nestjs/cache-manager";

export const cacheConfig = (configService: ConfigService): CacheModuleOptions => ({
  stores: [
    createKeyvRedis({
      url: configService.get("REDIS_URL"),
      ttl: configService.get("CACHE_TTL"),
      password: configService.get("REDIS_PASSWORD"),
    }),
    createKeyv({ ttl: configService.get("MEMORY_CACHE_TTL") }),
  ],
});
```

数组顺序即优先级：命中 Redis 就不查内存。注册时必须 `isGlobal: true`，
否则每个模块都要重新 import。

### 3.4 `jwt.config.ts`（双密钥）

```ts
import { JwtModuleOptions } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";

export const jwtConfig = (configService: ConfigService): JwtModuleOptions => ({
  secret: configService.get<string>("JWT_SECRET", "your-secret-key"),
  signOptions: { expiresIn: configService.get<string>("JWT_EXPIRES_IN", "24h") as any },
});

export const jwtRefreshConfig = (configService: ConfigService): JwtModuleOptions => ({
  secret: configService.get<string>("JWT_REFRESH_SECRET", "your-refresh-secret-key"),
  signOptions: { expiresIn: configService.get<string>("JWT_REFRESH_EXPIRES_IN", "30d") as any },
});
```

**关键**：refresh token 必须用 `JwtModule.register({ ...jwtRefreshConfig })` 的第二实例签名，
不能复用 access 实例。推荐在 `AuthModule` 里注册两个具名 JwtModule：

```ts
@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({ imports: [ConfigModule], useFactory: jwtConfig, inject: [ConfigService] }),
  ],
  providers: [JwtRefreshService, JwtStrategy],
  exports: [JwtModule],
})
export class AuthModule {}
```

### 3.5 `validation.config.ts`（全局校验）

```ts
import { ValidationPipeOptions } from "@nestjs/common";

export const validationConfig: ValidationPipeOptions = {
  transform: true,
  transformOptions: { enableImplicitConversion: true },
  whitelist: true,              // 剥离 DTO 未声明的字段
  forbidNonWhitelisted: false,  // 传未知字段不报错，静默剥离
  skipMissingProperties: false,
  skipNullProperties: false,
  skipUndefinedProperties: false,
};
```

`enableImplicitConversion` 让 query 里的 `"1"` 自动变 `number`，否则每个参数都要写 `@Type(() => Number)`。

### 3.6 `swagger.config.ts`

```ts
import { DocumentBuilder } from "@nestjs/swagger";

export const swaggerConfig = new DocumentBuilder()
  .setTitle("API")
  .setDescription("API 文档")
  .setVersion("1.0")
  .addBearerAuth()
  .addTag("用户管理", "用户注册、登录、权限管理")
  .build();
```

### 3.7 `logger.config.ts`（winston + 每日轮转）

```ts
import { ConfigService } from "@nestjs/config";
import * as winston from "winston";
import * as DailyRotateFile from "winston-daily-rotate-file";

export const loggerConfig = (configService: ConfigService) => {
  const isProduction = configService.get("NODE_ENV") === "production";

  const logFormat = winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  );

  const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, context, trace }) =>
      `${timestamp} [${context ?? ""}] ${level}: ${message}${trace ? `\n${trace}` : ""}`),
  );

  const fileTransports = [
    new DailyRotateFile({
      filename: "logs/error-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      level: "error",
      maxSize: "20m",
      maxFiles: "14d",
      format: logFormat,
    }),
    new DailyRotateFile({
      filename: "logs/combined-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxSize: "20m",
      maxFiles: "14d",
      format: logFormat,
    }),
  ];

  return {
    transports: isProduction
      ? fileTransports
      : [new winston.transports.Console({ format: consoleFormat }), ...fileTransports],
    level: isProduction ? "info" : "debug",
    format: logFormat,
  };
};
```

**必须在根模块接线**，否则配置写了也不生效：

```ts
import { WinstonModule } from "nest-winston";

WinstonModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: loggerConfig,
  inject: [ConfigService],
}),
```

### 3.8 `mailer.config.ts`

```ts
import { ConfigService } from "@nestjs/config";
import { MailerOptions } from "@nestjs-modules/mailer";

export const mailerConfig = (configService: ConfigService): MailerOptions => ({
  transport: {
    host: configService.get<string>("MAIL_HOST"),
    port: parseInt(configService.get<string>("MAIL_PORT", "587"), 10),
    secure: false,
    auth: {
      user: configService.get<string>("MAIL_USER"),
      pass: configService.get<string>("MAIL_PASSWORD"),
    },
  },
  defaults: {
    from: `"${configService.get<string>("MAIL_FROM_NAME")}" <${configService.get<string>("MAIL_FROM")}>`,
  },
});
```

### 3.9 `app.config.ts`（命名空间配置）

```ts
import { registerAs } from "@nestjs/config";

export const appConfig = registerAs("app", () => ({
  name: process.env.APP_NAME || "App",
  version: process.env.APP_VERSION || "1.0.0",
  forceUpdate: process.env.APP_FORCE_UPDATE === "true",
  maintenance: process.env.APP_MAINTENANCE === "true",
  maintenanceMessage: process.env.APP_MAINTENANCE_MESSAGE || "维护中，请稍后再试",
}));
```

`registerAs` 出来的配置**必须**在 `ConfigModule.forRoot({ load: [appConfig, uploadConfig] })`
里显式 load，否则 `configService.get("app.name")` 拿不到值。

### 3.10 `upload.config.ts`（图片尺寸矩阵 + 视频压缩）

```ts
import { registerAs } from "@nestjs/config";

export interface ImageSizeConfig {
  name: string;
  width: number;
  height?: number;
  quality: number;
  fit: "cover" | "contain" | "fill" | "inside" | "outside";
}

export const defaultImageSizes: ImageSizeConfig[] = [
  { name: "thumb",  width: 200,  height: 200, quality: 75, fit: "cover" },
  { name: "small",  width: 400,  quality: 80, fit: "inside" },
  { name: "medium", width: 800,  quality: 85, fit: "inside" },
  { name: "large",  width: 1600, quality: 85, fit: "inside" },
];

export const uploadConfig = registerAs("upload", () => ({
  compression: {
    enabled: process.env.UPLOAD_COMPRESSION_ENABLED !== "false",
    format: (process.env.UPLOAD_COMPRESSION_FORMAT as any) || "webp",
    quality: parseInt(process.env.UPLOAD_COMPRESSION_QUALITY || "85", 10),
    maxWidth: parseInt(process.env.UPLOAD_COMPRESSION_MAX_WIDTH || "3840", 10),
    maxHeight: parseInt(process.env.UPLOAD_COMPRESSION_MAX_HEIGHT || "2160", 10),
    keepOriginal: process.env.UPLOAD_KEEP_ORIGINAL !== "false",
    sizes: defaultImageSizes,
  },
  clientHint: {
    maxWidth: parseInt(process.env.UPLOAD_CLIENT_MAX_WIDTH || "1920", 10),
    quality: parseInt(process.env.UPLOAD_CLIENT_QUALITY || "75", 10),
    format: process.env.UPLOAD_CLIENT_FORMAT || "webp",
  },
  videoCompression: {
    enabled: process.env.VIDEO_COMPRESSION_ENABLED !== "false",
    preset: process.env.VIDEO_COMPRESSION_PRESET || "medium",
    crf: parseInt(process.env.VIDEO_COMPRESSION_CRF || "23", 10),
    maxWidth: parseInt(process.env.VIDEO_COMPRESSION_MAX_WIDTH || "1920", 10),
    maxHeight: parseInt(process.env.VIDEO_COMPRESSION_MAX_HEIGHT || "1080", 10),
    videoBitrate: process.env.VIDEO_COMPRESSION_BITRATE || "5000k",
    audioBitrate: process.env.VIDEO_COMPRESSION_AUDIO_BITRATE || "128k",
    minFileSize: parseInt(process.env.VIDEO_COMPRESSION_MIN_SIZE || "10", 10) * 1024 * 1024,
    timeout: parseInt(process.env.VIDEO_COMPRESSION_TIMEOUT || "600000", 10),
  },
}));
```

设计原则：**WebP 优先**（同质量比 JPEG 小 25-35%，比 PNG 小 60-80%），
保留原图供下载/二次编辑，多尺寸预生成避免运行时缩放。

### 3.11 `elasticsearch.config.ts`（可选启用）

```ts
import { ConfigService } from "@nestjs/config";
import { ElasticsearchModuleOptions } from "@nestjs/elasticsearch";

export const elasticsearchConfig = (
  configService: ConfigService,
): ElasticsearchModuleOptions | null => {
  const node = configService.get<string>("ELASTICSEARCH_NODE");
  if (!node) return null; // 未配置即禁用，不阻塞启动

  return {
    node,
    auth: {
      username: configService.get<string>("ELASTICSEARCH_USERNAME") || "",
      password: configService.get<string>("ELASTICSEARCH_PASSWORD") || "",
    },
    maxRetries: 3,
    requestTimeout: 30000,
  };
};

export const ELASTICSEARCH_INDEX = {
  ARTICLES: "articles",
  USERS: "users",
};
```

配套的 `SearchModule.forRoot()` 用动态模块模式，把 `registerAsync` 包起来：

```ts
@Module({})
export class SearchModule {
  static forRoot(): DynamicModule {
    return {
      module: SearchModule,
      imports: [
        ElasticsearchModule.registerAsync({
          imports: [ConfigModule],
          useFactory: async (configService: ConfigService) => elasticsearchConfig(configService)!,
          inject: [ConfigService],
        }),
      ],
      providers: [SearchService],
      exports: [SearchService],
      global: false,
    };
  }
}
```

业务侧统一用 `isElasticsearchEnabled()` 做开关，命中不到就走数据库降级查询。

### 3.12 `multer.config.ts`（本地 / S3 双存储）

核心结构（省略细节实现，按需展开）：

```ts
const DEFAULT_MAX_IMAGE_SIZE = 20 * 1024 * 1024;   // 20MB
const DEFAULT_MAX_VIDEO_SIZE = 500 * 1024 * 1024;  // 500MB
const DEFAULT_MAX_AUDIO_SIZE = 50 * 1024 * 1024;   // 50MB
const DEFAULT_MAX_OTHER_SIZE = 100 * 1024 * 1024;  // 100MB
const DEFAULT_MAX_FILE_COUNT = 10;

export const multerConfig = (configService: ConfigService): MulterOptions => {
  const storageType = configService.get("MULTER_STORAGE", "local");
  const commonOptions = buildCommonOptions(configService); // fileFilter + limits

  if (storageType === "s3") {
    return {
      ...commonOptions,
      storage: multerS3({
        s3: createS3Client(s3Config),
        bucket: s3Config.bucket,
        acl: "public-read",
        cacheControl: "max-age=31536000, public",
        contentType: multerS3.AUTO_CONTENT_TYPE,
        key: (_req, file, cb) => {
          file.originalname = Buffer.from(file.originalname, "latin1").toString("utf8");
          cb(null, generateFilePath(file, configService));
        },
      }),
    };
  }

  return {
    ...commonOptions,
    storage: diskStorage({
      destination: (_req, _file, cb) => cb(null, ensureDailyDir(configService)),
      filename: (_req, file, cb) => {
        file.originalname = Buffer.from(file.originalname, "latin1").toString("utf8");
        cb(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`);
      },
    }),
  };
};
```

三个必须点：

1. **中文文件名乱码**：multer 按 `latin1` 解析 `originalname`，
   必须 `Buffer.from(name, "latin1").toString("utf8")` 修回。
2. **按 MIME 分级限流**：`fileFilter` 里根据 `file.mimetype` 选不同的 maxSize，
   `limits.fileSize` 取所有类型中的最大值作为硬上限兜底。
3. **`fileFilter` 里读 `content-length` 只能拿到整个请求体大小**，
   多文件上传时会误判单文件超限。精确校验要在文件落盘后按 `file.size` 复核，
   或改用前端直传（presigned URL）。

---

## 4. 引导层 `main.ts`

```ts
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { SwaggerModule } from "@nestjs/swagger";
import { Cache } from "cache-manager";
import * as compression from "compression";
import helmet from "helmet";
import { writeFileSync } from "fs";
import { extname, join } from "path";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { LoggingInterceptor, TransformInterceptor } from "./common/interceptors";
import { CacheUtil, ConfigUtil, LoggerUtil } from "./common/utils";
import { AppModule } from "./app.module";
import { swaggerConfig, validationConfig } from "./config";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".svg", ".bmp", ".ico"]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".webm", ".mov", ".avi", ".mkv", ".flv", ".m4v"]);

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ["error", "warn", "log", "debug", "verbose"],
  });

  // 1. 优雅关闭
  app.enableShutdownHooks();

  const configService = app.get(ConfigService);
  const staticImageCacheMaxAgeSeconds = parseInt(
    configService.get<string>("STATIC_IMAGE_CACHE_MAX_AGE_SECONDS", "2592000"), 10);
  const staticImageCacheImmutable =
    configService.get<string>("STATIC_IMAGE_CACHE_IMMUTABLE") !== "false";

  // 2. 静态资源响应头
  const setStaticHeaders = (res: any, filePath: string) => {
    const ext = extname(filePath).toLowerCase();
    // 覆盖 helmet 的 same-origin，允许前端跨域加载图片
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");

    if (IMAGE_EXTENSIONS.has(ext)) {
      const directives = ["public", `max-age=${Math.max(0, staticImageCacheMaxAgeSeconds)}`];
      if (staticImageCacheImmutable) directives.push("immutable");
      res.setHeader("Cache-Control", directives.join(", "));
    }
    if (VIDEO_EXTENSIONS.has(ext)) {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Range, Accept-Ranges");
      res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges");
    }
  };

  // 3. 反向代理下拿真实 IP
  app.set("trust proxy", true);

  // 4. 安全头（HSTS 交给 nginx，这里关掉避免重复）
  app.use(helmet({ strictTransportSecurity: false }));

  // 5. Gzip
  app.use(compression());

  // 6. 全局管道 / 拦截器 / 过滤器（顺序即洋葱模型外层到内层）
  app.useGlobalPipes(new ValidationPipe(validationConfig));
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  // 7. Swagger 仅非生产环境
  const nodeEnv = process.env.NODE_ENV || "development";
  if (nodeEnv !== "production") {
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup("api", app, document);
    writeFileSync("./swagger.json", JSON.stringify(document, null, 2));
  }

  // 8. 静态资源：上传目录 + public
  app.useStaticAssets(join(__dirname, "..", process.env.MULTER_DEST || "uploads"), {
    prefix: "/uploads/",
    index: false,
    setHeaders: setStaticHeaders,
  });
  app.useStaticAssets(join(__dirname, "..", "public"), {
    prefix: "/public/",
    index: false,
    setHeaders: setStaticHeaders,
  });

  // 9. 全局前缀与 CORS
  app.setGlobalPrefix("api/v1");
  app.enableCors();

  const port = process.env.PORT || 3000;
  await app.listen(port);

  // 10. 启动自检
  ConfigUtil.checkAllConfig(configService);
  const cacheManager = app.get<Cache>(CACHE_MANAGER);
  const cacheTestResult = await CacheUtil.testCache(cacheManager);
  if (!cacheTestResult) await CacheUtil.diagnosticTest(cacheManager);

  LoggerUtil.info(`Application is running on: http://localhost:${port}`, "Bootstrap");
}

void bootstrap().catch((error) => {
  LoggerUtil.error("应用启动失败", error, "Bootstrap");
  process.exit(1);
});
```

**顺序要点**：

- `trust proxy` 必须在 `helmet` 之前，否则 `x-forwarded-proto` 判断错误。
- 静态资源注册要在 `setGlobalPrefix` **之前**，否则 `/uploads/xxx` 会被套上 `/api/v1` 前缀。
- `enableShutdownHooks()` 要在 `listen()` 之前，否则队列里的任务会被硬中断。

---

## 5. 根模块 `app.module.ts`

```ts
import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CacheModule } from "@nestjs/cache-manager";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { MailerModule } from "@nestjs-modules/mailer";
import { WinstonModule } from "nest-winston";
import {
  databaseConfig, cacheConfig, mailerConfig, uploadConfig, loggerConfig,
} from "./config";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env.local", ".env"],
      load: [uploadConfig, appConfig],   // registerAs 的配置必须在这里 load
    }),
    WinstonModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: loggerConfig,
      inject: [ConfigService],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: databaseConfig,
      inject: [ConfigService],
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: cacheConfig,
      inject: [ConfigService],
    }),
    EventEmitterModule.forRoot(),
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: mailerConfig,
      inject: [ConfigService],
    }),
    // ...业务模块
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
```

**全局守卫的注册顺序即执行顺序**：`APP_GUARD` 按 providers 数组的先后依次执行。
鉴权守卫放最前，限流/域名校验类守卫放其后。

---

## 6. 请求管线

### 6.1 响应契约

统一为 `{ code, message, data, timestamp?, path? }`。
成功与失败的字段必须一致——`BaseResponseDto` 声明了 `timestamp` / `path`，
那么成功响应里也必须有，否则前端类型对不上。

```ts
// common/interfaces/response.interface.ts
export interface BaseResponse<T = any> {
  code: number;
  message: string;
  data: T;
  timestamp: number;
}

export interface PaginatedResponse<T = any> {
  code: number;
  message: string;
  data: T[];
  meta: PaginationMeta;
  timestamp: number;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ListResult<T = any> {
  data: T[];
  meta?: PaginationMeta;
}
```

### 6.2 `TransformInterceptor`（统一成功响应）

```ts
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    const request = context.switchToHttp().getRequest<Request>();
    return next.handle().pipe(
      map((data: T) => ({
        code: 200,
        message: "操作成功",
        data,
        timestamp: Date.now(),
        path: request.url,
      })),
    );
  }
}
```

### 6.3 `LoggingInterceptor`（耗时日志）

```ts
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const startTime = Date.now();
    const { method, url, ip, headers } = request;

    LoggerUtil.info(`Request started: ${method} ${url}`, "HTTP", {
      ip, userAgent: headers["user-agent"] || "",
      body: request.body, query: request.query, params: request.params,
    });

    return next.handle().pipe(
      tap({
        next: () => {
          LoggerUtil.info(
            `Request completed: ${method} ${url} - ${response.statusCode} - ${Date.now() - startTime}ms`,
            "HTTP",
          );
        },
        error: (error: { status?: number }) => {
          LoggerUtil.error(
            `Request failed: ${method} ${url} - ${error.status || 500} - ${Date.now() - startTime}ms`,
            error, "HTTP",
          );
        },
      }),
    );
  }
}
```

**注意**：`LoggingInterceptor` 会对所有请求（含静态资源）打日志，
高并发下是 IO 瓶颈。生产环境建议加路径白名单或降级为采样。

### 6.4 `HttpExceptionFilter`（统一错误响应）

```ts
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse() as any;

    let message = exception.message;
    if (Array.isArray(exceptionResponse.message)) {
      if (status === HttpStatus.BAD_REQUEST) message = exceptionResponse.message[0];
    } else if (typeof exceptionResponse.message === "string") {
      message = exceptionResponse.message;
    } else {
      switch (status) {
        case HttpStatus.UNAUTHORIZED: message = "response.error.userNotLogin"; break;
        case HttpStatus.FORBIDDEN:    message = "response.error.permissionDenied"; break;
        case HttpStatus.NOT_FOUND:    message = "response.error.resourceNotFound"; break;
        case HttpStatus.CONFLICT:     message = "response.error.resourceConflict"; break;
      }
    }

    response.status(status).json({
      code: status,
      message: message || "response.error.serverError",
      data: null,
      timestamp: Date.now(),
      path: request.url,
    });
  }
}
```

`@Catch(HttpException)` 只捕 `HttpException`。
若还要兜住未捕获异常（DB 断连、TypeError），另加一个 `@Catch()` 的全捕获过滤器。

**消息用 i18n key**（如 `response.error.unauthorized`）而不是中文字面量，
前端做多语言时不用改后端。

### 6.5 异常体系

```ts
export class BusinessException extends HttpException {
  constructor(message: string, code: number = HttpStatus.BAD_REQUEST) {
    super({ code, message, data: null, timestamp: Date.now() }, code);
  }
}

export class UnauthorizedBusinessException extends BusinessException {
  constructor(message = "response.error.unauthorized") { super(message, HttpStatus.UNAUTHORIZED); }
}
export class ForbiddenBusinessException extends BusinessException {
  constructor(message = "response.error.permissionDenied") { super(message, HttpStatus.FORBIDDEN); }
}
export class NotFoundBusinessException extends BusinessException {
  constructor(message = "response.error.resourceNotFound") { super(message, HttpStatus.NOT_FOUND); }
}
export class ConflictBusinessException extends BusinessException {
  constructor(message = "response.error.resourceConflict") { super(message, HttpStatus.CONFLICT); }
}
export class TooManyRequestException extends HttpException {
  constructor(message = "请求过于频繁，请稍后再试") {
    super({ code: 429, message, data: null, timestamp: Date.now() }, HttpStatus.TOO_MANY_REQUESTS);
  }
}
```

业务层只抛这几种，HTTP 状态码与业务码强绑定，`HttpExceptionFilter` 直接透传。

---

## 7. 认证与授权

### 7.1 JWT Strategy（含 WebSocket 兼容）

```ts
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    @InjectRepository(User) private userRepository: Repository<User>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    super({
      jwtFromRequest: (req) => {
        // 兼容 WebSocket handshake 与普通 HTTP
        if (req.handshake?.headers?.authorization) {
          return ExtractJwt.fromAuthHeaderAsBearerToken()({
            headers: { authorization: req.handshake.headers.authorization },
          });
        }
        return ExtractJwt.fromAuthHeaderAsBearerToken()(req);
      },
      ignoreExpiration: false,
      secretOrKey: configService.get<string>("JWT_SECRET", "your-secret-key"),
      passReqToCallback: true,
    });
  }

  async validate(req: Request | any, payload: JwtPayload): Promise<User> {
    const deviceId =
      getHeaderValue(req.handshake?.headers, "device-id") ||
      getHeaderValue(req.headers, "device-id") ||
      payload.deviceId;

    // 多设备：校验该设备的 token 是否还在缓存里（= 是否被登出）
    const cachedToken = await this.cacheManager.get(`user:${payload.sub}:device:${deviceId}:token`);
    if (!cachedToken) throw new UnauthorizedException("response.error.tokenInvalid");

    const user = await this.loadAuthUser(payload.sub); // 带 60s 缓存的用户加载
    if (user.status === "BANNED") throw new ForbiddenException("账号已被封禁");

    return user; // 挂到 request.user
  }
}
```

**多设备登出的实现要点**：登录时把 token 写进 `user:{id}:device:{deviceId}:token`，
登出时 delete 该 key —— 比维护 JWT 黑名单轻得多。

### 7.2 `JwtAuthGuard`（带 `@NoAuth()` 旁路）

```ts
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  constructor(private reflector: Reflector) { super(); }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const noAuth = this.reflector.getAllAndOverride<boolean>("no-auth", [
      context.getHandler(), context.getClass(),
    ]);
    try {
      return (await super.canActivate(context)) as boolean;
    } catch (err) {
      if (noAuth) return true;  // 标记了 @NoAuth 就放行
      throw err;
    }
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext): any {
    const noAuth = this.reflector.getAllAndOverride<boolean>("no-auth", [
      context.getHandler(), context.getClass(),
    ]);
    if (noAuth) return user || null;   // 关键：登录可选，匿名也能拿到 null
    if (err || !user) throw new UnauthorizedException("response.error.unauthorized");
    return user;
  }
}
```

这个设计的价值：`@NoAuth()` 接口既能匿名访问，**又能识别已登录用户**（如"游客可浏览、登录用户看已点赞"）。
如果改成"跳过校验"，就拿不到 `request.user` 了。

### 7.3 权限守卫 + 装饰器

```ts
// common/decorators/permissions.decorator.ts
export const PERMISSIONS_KEY = "permissions";
export const Permissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);

// common/decorators/no-auth.decorator.ts
export const NoAuth = () => SetMetadata("no-auth", true);

// common/guards/permission.guard.ts
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(), context.getClass(),
    ]);
    if (!required?.length) return true;   // 没声明权限 = 只要登录就放行

    const user: User = context.switchToHttp().getRequest().user;
    if (!user) throw new UnauthorizedException("response.error.userNotLogin");

    const userPermissions = user.roles?.flatMap((r) => r.permissions).map((p) => p.name) || [];
    if (!required.some((p) => userPermissions.includes(p))) {
      throw new ForbiddenException("response.error.permissionDenied");
    }
    return true;
  }
}
```

`PermissionGuard` **不做全局注册**，因为它需要 `request.user` 已就绪，
且各接口权限粒度不同。用法固定为：

```ts
@UseGuards(JwtAuthGuard, PermissionGuard)
@Permissions("article:delete")
@Delete(":id")
remove(@Param("id") id: number) {}
```

`required.some(...)` 是"任一权限即可"，要"全部满足"改 `every`。

**RBAC 数据模型**：`User —(M:N)— Role —(M:N)— Permission`。
`JwtStrategy` 里用 `relations: ["roles", "roles.permissions"]` 一次捞出，
再配合 `user:{id}:permissions` 缓存（TTL 60s），避免每个请求三表 join。

**权限变更后的缓存失效**：改角色/权限时必须主动清 `user:{id}:permissions` 系列 key，
否则最多 60s 内旧权限仍生效。

---

## 8. 通用 DTO

```ts
// common/dto/pagination.dto.ts
export class PaginationDto {
  @ApiProperty({ description: "页码", required: false, default: 1, minimum: 1 })
  @Type(() => Number) @IsInt() @Min(1) @IsOptional()
  page: number = 1;

  @ApiProperty({ description: "每页数量", required: false, default: 10, maximum: 100 })
  @Type(() => Number) @IsInt() @Min(1) @Max(100) @IsOptional()
  limit: number = 10;
}
```

`limit` 必须设 `@Max(100)`，否则 `?limit=999999` 就是一次 DoS。

---

## 9. 工具类清单

| 文件 | 内容 | 关键点 |
|---|---|---|
| `jwt.util.ts` | `JwtUtil`：签发/校验/清 token | 多设备 key 存缓存，TTL 与 token 一致 |
| `cache.util.ts` | `CacheUtil`：测试/诊断/统计/批量/预热/健康检查 | 启动自检用，`createKey()` 统一 key 命名 |
| `logger.util.ts` | `LoggerUtil`：静态日志门面 | info/error/warn/debug + API/DB/UserAction |
| `config.util.ts` | `ConfigUtil`：启动配置自检 | **必须真的校验并抛错**，否则等于没有 |
| `list.util.ts` | `ListUtil`：`buildPaginatedList` / `fromFindAndCount` | 统一分页结构 |
| `sanitize.util.ts` | `sanitizeUser` / `stripScriptTags` | 解构剔除敏感字段；XSS 过滤 |
| `permission.util.ts` | `PermissionUtil`：hasPermission / hasRole | 支持 `super-admin` 通配 |
| `header.util.ts` | `getHeaderValue` | header 名大小写不敏感读取 |
| `file-type.util.ts` | `FileTypeUtil`：magic number 探测 | **不要信客户端 MIME**，从 buffer 头字节判 |
| `image-serializer.util.ts` | `ImageSerializer`：图片对象序列化 | 多尺寸变体存取 |

`ConfigUtil` 的正确写法（不要只 get 不校验）：

```ts
static checkAllConfig(configService: ConfigService): void {
  const required = ["JWT_SECRET", "DB_HOST", "DB_DATABASE", "REDIS_URL"];
  const missing = required.filter((key) => !configService.get(key));
  if (missing.length) {
    throw new Error(`缺少必要环境变量: ${missing.join(", ")}`);
  }
  LoggerUtil.info("✅ 配置检查通过", "ConfigUtil");
}
```

---

## 10. 队列（Bull + Redis）

```ts
@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: (configService: ConfigService) => {
        const { host, port, password } = parseRedisUrl(configService.get("REDIS_URL"));
        return {
          redis: {
            host, port,
            password: configService.get("REDIS_PASSWORD") || password,
            keepAlive: 30000,
            retryStrategy: (times: number) => Math.min(times * 50, 2000),
          },
          defaultJobOptions: {
            attempts: 5,
            backoff: { type: "exponential", delay: 2000 },
            timeout: 300000,
            removeOnFail: false,     // 保留失败任务，重启后可见
            removeOnComplete: 100,   // 只留最近 100 个成功任务
            stalledInterval: 30000,
          },
          settings: {
            lockDuration: 30000,        // 锁续期窗口，必须 > 任务平均耗时
            stalledCheckInterval: 30000,
          },
        };
      },
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: "image-audit",
      defaultJobOptions: { attempts: 5, backoff: { type: "exponential", delay: 5000 }, timeout: 60000 },
    }),
    // ...更多队列
  ],
  providers: [ImageAuditProcessor],
  exports: [BullModule],
})
export class QueueModule {}
```

Processor 只需要装饰器 + `WorkerHost` 风格的方法：

```ts
@Processor("image-audit")
export class ImageAuditProcessor {
  private readonly logger = new Logger(ImageAuditProcessor.name);

  constructor(private configService: ConfigService) {}

  @Process("audit")
  async handleImageAudit(job: Job<ImageAuditJob>) { /* ... */ }

  @OnQueueFailed()
  onFailed(job: Job, err: Error) {
    this.logger.error(`任务 ${job.id} 失败: ${err.message}`);
  }
}
```

三个关键配置：

- `removeOnFail: false` + `attempts` 是最小可用可靠性组合，否则失败任务直接蒸发。
- `lockDuration` 必须大于单个任务的最长耗时，否则任务会被判定 stalled 并重复执行。
- 队列名要与 `registerQueue` 完全一致，拼错不会报错，只是永远不执行。

---

## 11. FFmpeg 模块

```ts
@Injectable()
export class FFmpegService implements OnModuleInit {
  private isAvailable = false;

  onModuleInit() { this.initialize(); }

  private initialize(): void {
    // 1. 先扫系统 PATH
    // 2. 再读 FFMPEG_PATH / FFPROBE_PATH 环境变量
    // 3. 都没有则 isAvailable = false，功能降级而不是崩溃
  }

  isFFmpegAvailable(): boolean { return this.isAvailable; }

  async getVideoMetadata(filePath: string): Promise<VideoMetadata> { /* ffprobe */ }
  async compressVideo(options: CompressionOptions, onProgress?): Promise<void> { /* libx264 + aac */ }
  async generateThumbnail(inputPath, outputPath, options?): Promise<void> { /* seekInput + frames(1) */ }
  async getDuration(filePath: string): Promise<number> { /* ... */ }
  async getResolution(filePath: string): Promise<{ width: number; height: number }> { /* ... */ }
}
```

**降级原则**：FFmpeg 是外部二进制依赖，容器里经常没有。
`isAvailable` 为 false 时应当是"跳过压缩、保留原视频"，
而不是抛异常让上传接口 500。

**实现坑**：`videoStream.r_frame_rate` 返回 `"30000/1001"` 这种分数。
解析用 `eval()` 能跑但危险 —— 改成 `const [num, den] = rate.split("/").map(Number); const fps = num / den;`。

---

## 12. 环境变量清单

```ini
# 应用
NODE_ENV=development
PORT=3000
APP_NAME=App
APP_VERSION=1.0.0
APP_FORCE_UPDATE=false
APP_MAINTENANCE=false
APP_MAINTENANCE_MESSAGE=维护中，请稍后再试

# 数据库
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=
DB_DATABASE=nest_db
DB_SYNC=false
DB_LOGGING=false
DB_CONNECTION_LIMIT=25
DB_POOL_SIZE=10

# Redis / 缓存
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=
CACHE_TTL=60000
MEMORY_CACHE_TTL=10000

# JWT
JWT_SECRET=change-me-in-production
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET=change-me-too
JWT_REFRESH_EXPIRES_IN=30d
JWT_AUTH_USER_CACHE_TTL_MS=60000

# 邮件
MAIL_HOST=smtp.example.com
MAIL_PORT=587
MAIL_USER=
MAIL_PASSWORD=
MAIL_FROM=noreply@example.com
MAIL_FROM_NAME=App

# 上传
MULTER_STORAGE=local          # local | s3
MULTER_DEST=uploads
UPLOAD_ALLOWED_MIME_TYPES=    # 留空用内置白名单
UPLOAD_MAX_IMAGE_SIZE=20      # MB
UPLOAD_MAX_VIDEO_SIZE=500     # MB
UPLOAD_MAX_AUDIO_SIZE=50      # MB
UPLOAD_MAX_OTHER_SIZE=100     # MB
UPLOAD_MAX_FILE_COUNT=10
UPLOAD_COMPRESSION_ENABLED=true
UPLOAD_COMPRESSION_FORMAT=webp
UPLOAD_COMPRESSION_QUALITY=85
UPLOAD_KEEP_ORIGINAL=true

# S3（MULTER_STORAGE=s3 时必填）
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_BUCKET=
AWS_ENDPOINT=
AWS_FORCE_PATH_STYLE=false
AWS_CDN_DOMAIN=

# Elasticsearch（留空即禁用）
ELASTICSEARCH_NODE=
ELASTICSEARCH_USERNAME=
ELASTICSEARCH_PASSWORD=

# 视频
VIDEO_COMPRESSION_ENABLED=true
VIDEO_COMPRESSION_CRF=23
VIDEO_COMPRESSION_PRESET=medium
VIDEO_COMPRESSION_MAX_WIDTH=1920
VIDEO_COMPRESSION_MAX_HEIGHT=1080
FFMPEG_PATH=
FFPROBE_PATH=

# 静态资源缓存
STATIC_IMAGE_CACHE_MAX_AGE_SECONDS=2592000
STATIC_IMAGE_CACHE_IMMUTABLE=true
```

---

## 13. 落地检查清单

搭完骨架后，逐项确认：

- [ ] `ConfigModule.forRoot({ isGlobal: true, load: [...] })` —— 所有 `registerAs` 的配置都 load 了
- [ ] `WinstonModule.forRootAsync` 已注册（否则日志配置不生效）
- [ ] `CacheModule` 是 `isGlobal: true`（否则每个模块都要 import）
- [ ] `app.setGlobalPrefix` 在 `useStaticAssets` **之后**
- [ ] `enableShutdownHooks()` 在 `listen()` 之前
- [ ] 全局 Guard 顺序：鉴权 → 限流/校验
- [ ] 成功响应与错误响应的字段完全一致
- [ ] `ValidationPipe` 开了 `whitelist`，`PaginationDto` 有 `@Max`
- [ ] `synchronize: false`（生产环境）
- [ ] `db.type` 为 mysql 时，`extra` 里没有 mysql2 不认识的选项
- [ ] refresh token 用的是独立的 secret 与 JwtModule 实例
- [ ] 队列名与 `registerQueue` 一致；`removeOnFail: false`
- [ ] FFmpeg 不可用时走降级而不是抛错
- [ ] 上传文件的中文名已做 latin1 → utf8 修正
- [ ] `common/` 没有 import `modules/`

---

## 14. 已知设计取舍

以下不是 bug，是刻意的选择，新项目按需保留：

1. **统一 HTTP 200 + 业务码** vs **用真实 HTTP 状态码**
   本项目选后者（`code` 直接等于 HTTP status）。优点是语义标准、Swagger/网关/前端拦截器都能直接用；
   代价是业务码与 HTTP 码强耦合，新增业务码时要选一个语义接近的 HTTP 码。

2. **`@NoAuth()` 而非跳过鉴权**
   允许匿名但保留身份识别，是"游客/登录用户同接口不同视图"场景的唯一优雅解法。

3. **软删除**
   所有业务表建议带 `deletedAt`，查询统一加 `deletedAt IS NULL` 条件。
   用 TypeORM 的 `@DeleteDateColumn` 可以自动处理。

4. **`insecureAuth: true`**
   只在 MySQL 8 用旧的 `mysql_native_password` 插件时才需要。用 `caching_sha2_password` 时应删掉。

5. **静态资源由 Nest 直出**
   开发期方便，生产期建议交给 nginx/CDN，Nest 只保留 API。

---

## 15. 与前端的接口约定

- 所有业务接口前缀 `/api/v1`
- 静态资源 `/uploads/**`、`/public/**`（无前缀）
- 认证：`Authorization: Bearer <accessToken>` + `device-id: <uuid>` 双头
- 分页参数：`?page=1&limit=10`，响应 `data.data[] + data.meta`
- 错误消息返回 i18n key，前端自行翻译
- 时间字段统一毫秒时间戳（`Date.now()`），不用 ISO 字符串 —— 混用会导致前端解析歧义
