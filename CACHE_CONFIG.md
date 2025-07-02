# 缓存配置说明

## 概述
本项目使用 `cache-manager` 作为缓存抽象层，支持 Redis 和内存缓存两种存储方式。

## 配置选项

### 环境变量

```bash
# 是否使用 Redis 缓存
USE_REDIS=true

# Redis 连接 URL
REDIS_URL=redis://localhost:6379

# 缓存过期时间（秒）
CACHE_TTL=3600

# 缓存最大条目数
CACHE_MAX=1000

# 内存缓存过期时间（毫秒）
MEMORY_CACHE_TTL=3600000

# 内存缓存最大条目数
MEMORY_CACHE_SIZE=1000
```

## 缓存策略

### 优先级
1. **Redis 缓存**：如果 `USE_REDIS=true` 且 `REDIS_URL` 可用，优先使用 Redis
2. **内存缓存**：如果 Redis 不可用，自动回退到内存缓存

### 自动回退机制
- 当 Redis 连接失败时，系统会自动切换到内存缓存
- 控制台会显示相应的警告信息
- 应用不会因为缓存问题而启动失败

## 使用方式

### 在服务中注入缓存
```typescript
import { Inject, CACHE_MANAGER } from '@nestjs/common';
import { Cache } from 'cache-manager';

@Injectable()
export class YourService {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async someMethod() {
    // 设置缓存
    await this.cacheManager.set('key', 'value', 60000);
    
    // 获取缓存
    const value = await this.cacheManager.get('key');
    
    // 删除缓存
    await this.cacheManager.del('key');
  }
}
```

### JWT Token 缓存
JWT 工具类会自动将 token 存储到缓存中：
- Access Token：与 JWT 过期时间一致
- Refresh Token：与 JWT 刷新过期时间一致

## 测试缓存

应用启动时会自动测试缓存功能：
- 写入测试数据
- 读取测试数据
- 删除测试数据
- 在控制台显示测试结果

## 故障排除

### Redis 连接失败
1. 检查 Redis 服务是否运行
2. 检查 `REDIS_URL` 是否正确
3. 检查网络连接
4. 查看控制台警告信息

### 内存缓存问题
1. 检查内存使用情况
2. 调整 `MEMORY_CACHE_SIZE` 参数
3. 检查缓存过期时间设置

## 性能优化

### Redis 配置建议
```bash
# 生产环境 Redis 配置
REDIS_URL=redis://username:password@host:port/database
CACHE_TTL=3600  # 1小时
CACHE_MAX=10000
```

### 内存缓存配置建议
```bash
# 开发环境内存缓存配置
MEMORY_CACHE_TTL=3600000  # 1小时
MEMORY_CACHE_SIZE=1000
```

## 监控和调试

### 缓存工具类
使用 `CacheUtil` 类进行缓存测试和调试：
```typescript
import { CacheUtil } from './common/utils';

// 测试缓存
const result = await CacheUtil.testCache(cacheManager);

// 获取缓存统计
const stats = await CacheUtil.getCacheStats(cacheManager);
``` 