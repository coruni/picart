import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { TransformInterceptor, LoggingInterceptor } from './common/interceptors';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { swaggerConfig, validationConfig } from './config';
import { LoggerUtil, CacheUtil, ConfigUtil } from './common/utils';
import { writeFileSync } from 'fs';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { Cache } from 'cache-manager';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import * as compression from 'compression';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

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

  // Swagger配置
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, document);

  // 导出 Swagger JSON 文件
  writeFileSync('./swagger.json', JSON.stringify(document, null, 2));
  // 静态资源地址为：http://localhost:端口/static/文件路径
  app.useStaticAssets(join(__dirname, '..', '/'), {
    prefix: '/static/',
    index: false,
  });
  // 全局CORS
  // 全局前缀
  app.setGlobalPrefix('api/v1');
  app.enableCors();

  const port = process.env.PORT || 3000;
  await app.listen(port);

  // 检查配置
  try {
    const configService = app.get(ConfigService);
    ConfigUtil.checkAllConfig(configService);
  } catch (error) {
    LoggerUtil.error('配置检查失败', error, 'Bootstrap');
  }

  // 测试缓存功能
  try {
    const cacheManager = app.get<Cache>(CACHE_MANAGER);

    // 获取缓存统计信息
    const cacheStats = await CacheUtil.getCacheStats(cacheManager);
    LoggerUtil.info(`📊 缓存统计信息: ${JSON.stringify(cacheStats)}`, 'Bootstrap');

    // 基础缓存测试
    const cacheTestResult = await CacheUtil.testCache(cacheManager);
    if (cacheTestResult) {
      LoggerUtil.info('✅ 缓存系统测试通过', 'Bootstrap');
    } else {
      LoggerUtil.warn('⚠️ 缓存系统测试失败', 'Bootstrap');

      // 如果基础测试失败，运行详细诊断
      LoggerUtil.info('🔬 运行详细缓存诊断...', 'Bootstrap');
      await CacheUtil.diagnosticTest(cacheManager);
    }
  } catch (error) {
    LoggerUtil.error('缓存系统初始化失败', error, 'Bootstrap');
  }

  LoggerUtil.info(`🚀 Application is running on: http://localhost:${port}`, 'Bootstrap');
  LoggerUtil.info(`📚 Swagger documentation: http://localhost:${port}/api`, 'Bootstrap');
}

// 处理未捕获的Promise拒绝
void bootstrap().catch((error) => {
  LoggerUtil.error('应用启动失败', error, 'Bootstrap');
  process.exit(1);
});
