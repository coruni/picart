import { createKeyv } from 'cacheable';
import { createKeyv as createKeyvRedis } from '@keyv/redis';
import { ConfigService } from '@nestjs/config';
import { CacheModuleOptions } from '@nestjs/cache-manager';

export const cacheConfig = (configService: ConfigService):CacheModuleOptions => ({
  stores: [
    createKeyvRedis({
      url: configService.get('REDIS_URL'),
      ttl: configService.get('CACHE_TTL'),
      password:configService.get('REDIS_PASSWORD')
    }),
    createKeyv({
      ttl: configService.get('MEMORY_CACHE_TTL'),
    }),
  ],
});
