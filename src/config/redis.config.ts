import { ConfigService } from '@nestjs/config';
import { CacheModuleOptions } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';
import { Keyv } from 'keyv';
import { CacheableMemory } from 'cacheable';

export const redisConfig = async (configService: ConfigService): Promise<CacheModuleOptions> => {
  const redisUrl = configService.get<string>('REDIS_URL');
  const useRedis = configService.get<boolean>('USE_REDIS', true);
  
  // 如果配置使用 Redis 且有 Redis URL，则使用 Redis
  if (useRedis && redisUrl) {
    try {
      const store = await redisStore({
        url: redisUrl,
        ttl: configService.get<number>('CACHE_TTL', 3600), // 默认1小时
        max: configService.get<number>('CACHE_MAX', 1000),
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
      });
      
      console.log('✅ Redis 缓存已连接');
      
      return {
        store,
        ttl: configService.get<number>('CACHE_TTL', 3600),
        max: configService.get<number>('CACHE_MAX', 1000),
      };
    } catch (error) {
      console.warn('⚠️ Redis 连接失败，回退到内存缓存:', error.message);
    }
  }
  
  // 回退到内存缓存
  console.log('📦 使用内存缓存');
  const store = new Keyv({
    store: new CacheableMemory({ 
      ttl: configService.get<number>('MEMORY_CACHE_TTL', 3600000), // 默认1小时（毫秒）
      lruSize: configService.get<number>('MEMORY_CACHE_SIZE', 1000) 
    }),
  });
  
  return {
    store,
    ttl: configService.get<number>('MEMORY_CACHE_TTL', 3600000),
    max: configService.get<number>('MEMORY_CACHE_SIZE', 1000),
  };
}; 