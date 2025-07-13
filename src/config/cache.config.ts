import { createKeyv } from 'cacheable';
import { createKeyv as createKeyvRedis } from '@keyv/redis';
import { ConfigService } from '@nestjs/config';

export const cacheConfig = (configService: ConfigService) => ({
  stores: [
    createKeyvRedis({
      url: configService.get('REDIS_URL'),
      ttl: configService.get('CACHE_TTL'),
    }),
    createKeyv({
      ttl: configService.get('MEMORY_CACHE_TTL'),
    }),
  ],
});
