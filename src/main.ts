import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { SwaggerModule } from "@nestjs/swagger";
import { Cache } from "cache-manager";
import * as compression from "compression";
import { writeFileSync } from "fs";
import { extname, join } from "path";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import {
  LoggingInterceptor,
  TransformInterceptor,
} from "./common/interceptors";
import { CacheUtil, ConfigUtil, LoggerUtil } from "./common/utils";
import { AppModule } from "./app.module";
import { swaggerConfig, validationConfig } from "./config";

const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".avif",
  ".svg",
  ".bmp",
  ".ico",
]);

const VIDEO_EXTENSIONS = new Set([
  ".mp4",
  ".webm",
  ".mov",
  ".avi",
  ".mkv",
  ".flv",
  ".m4v",
]);

function parseBoolean(value: string | undefined, defaultValue: boolean) {
  if (value === undefined) {
    return defaultValue;
  }

  return value === "true";
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // 启用优雅关闭，让正在处理的任务完成
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // 启用关闭钩子，支持优雅关闭
  app.enableShutdownHooks();

  const configService = app.get(ConfigService);
  const staticImageCacheMaxAgeSeconds = parseInt(
    configService.get<string>("STATIC_IMAGE_CACHE_MAX_AGE_SECONDS", "2592000"),
    10,
  );
  const staticImageCacheImmutable = parseBoolean(
    configService.get<string>("STATIC_IMAGE_CACHE_IMMUTABLE"),
    true,
  );

  const setStaticHeaders = (res: any, filePath: string) => {
    const ext = extname(filePath).toLowerCase();

    // 为图片设置缓存头
    if (IMAGE_EXTENSIONS.has(ext)) {
      const directives = [
        "public",
        `max-age=${Math.max(0, staticImageCacheMaxAgeSeconds)}`,
      ];

      if (staticImageCacheImmutable) {
        directives.push("immutable");
      }

      res.setHeader("Cache-Control", directives.join(", "));
    }

    // 为视频文件设置 CORS 头，支持跨域播放
    if (VIDEO_EXTENSIONS.has(ext)) {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Range, Accept-Ranges");
      res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges");
    }
  };

  // 信任代理，获取真实客户端 IP 和协议
  app.set("trust proxy", true);

  // 启用 Gzip 压缩
  app.use(compression());

  // 全局验证管道
  app.useGlobalPipes(new ValidationPipe(validationConfig));

  // 全局响应转换拦截器
  app.useGlobalInterceptors(new TransformInterceptor());

  // 全局日志拦截器
  app.useGlobalInterceptors(new LoggingInterceptor());

  // 全局异常过滤器
  app.useGlobalFilters(new HttpExceptionFilter());

  // Swagger 配置
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api", app, document);

  // 导出 Swagger JSON 文件
  writeFileSync("./swagger.json", JSON.stringify(document, null, 2));

  // 静态资源地址示例：http://localhost:端口/uploads/文件路径
  app.useStaticAssets(
    join(__dirname, "..", process.env.MULTER_DEST || "uploads"),
    {
      prefix: "/uploads/",
      index: false,
      setHeaders: setStaticHeaders,
    },
  );
  app.useStaticAssets(join(__dirname, "..", "public"), {
    prefix: "/public/",
    index: false,
    setHeaders: setStaticHeaders,
  });

  // 全局前缀与 CORS
  app.setGlobalPrefix("api/v1");
  app.enableCors();

  const port = process.env.PORT || 3000;
  await app.listen(port);

  // 检查配置
  try {
    ConfigUtil.checkAllConfig(configService);
  } catch (error) {
    LoggerUtil.error("配置检查失败", error, "Bootstrap");
  }

  // 测试缓存功能
  try {
    const cacheManager = app.get<Cache>(CACHE_MANAGER);

    const cacheStats = await CacheUtil.getCacheStats(cacheManager);
    LoggerUtil.info(
      `缓存统计信息: ${JSON.stringify(cacheStats)}`,
      "Bootstrap",
    );

    const cacheTestResult = await CacheUtil.testCache(cacheManager);
    if (cacheTestResult) {
      LoggerUtil.info("缓存系统测试通过", "Bootstrap");
    } else {
      LoggerUtil.warn("缓存系统测试失败", "Bootstrap");
      LoggerUtil.info("运行详细缓存诊断...", "Bootstrap");
      await CacheUtil.diagnosticTest(cacheManager);
    }
  } catch (error) {
    LoggerUtil.error("缓存系统初始化失败", error, "Bootstrap");
  }

  LoggerUtil.info(
    `Application is running on: http://localhost:${port}`,
    "Bootstrap",
  );
  LoggerUtil.info(
    `Swagger documentation: http://localhost:${port}/api`,
    "Bootstrap",
  );
}

void bootstrap().catch((error) => {
  LoggerUtil.error("应用启动失败", error, "Bootstrap");
  process.exit(1);
});
