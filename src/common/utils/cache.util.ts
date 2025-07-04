import { Cache } from 'cache-manager';
import { LoggerUtil } from './logger.util';

/**
 * 缓存性能统计接口
 */
export interface CachePerformanceStats {
  hits: number;
  misses: number;
  hitRate: number;
  operations: number;
  errors: number;
  averageResponseTime: number;
  lastOperation: Date;
}

/**
 * 缓存健康状态接口
 */
interface CacheHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  memoryUsage?: number;
  connectionCount?: number;
  lastError?: string;
  errorCount: number;
  responseTime: number;
}

/**
 * 缓存工具类
 * 提供缓存测试、诊断、统计和管理功能
 */
export class CacheUtil {
  /**
   * 测试缓存是否正常工作
   * @param cacheManager 缓存管理器
   */
  static async testCache(cacheManager: Cache): Promise<boolean> {
    try {
      const testKey = 'cache_test_key';
      const testValue = { message: '缓存测试', timestamp: Date.now() };

      LoggerUtil.info('🧪 开始缓存测试...', 'CacheUtil');

      // 写入测试数据
      await cacheManager.set(testKey, testValue, 60000); // 1分钟过期
      LoggerUtil.info('✅ 缓存写入测试成功', 'CacheUtil');

      // 立即读取测试数据
      const retrievedValue = await cacheManager.get(testKey);
      LoggerUtil.info(
        `🔍 缓存读取结果: ${retrievedValue ? JSON.stringify(retrievedValue) : 'null'}`,
        'CacheUtil',
      );

      if (retrievedValue && JSON.stringify(retrievedValue) === JSON.stringify(testValue)) {
        LoggerUtil.info('✅ 缓存读取测试成功', 'CacheUtil');

        // 测试缓存是否真的存在
        const exists = await cacheManager.get(testKey);
        if (exists) {
          LoggerUtil.info('✅ 缓存持久性测试成功', 'CacheUtil');
        } else {
          LoggerUtil.error('❌ 缓存持久性测试失败', null, 'CacheUtil');
        }

        // 清理测试数据
        await cacheManager.del(testKey);
        LoggerUtil.info('✅ 缓存删除测试成功', 'CacheUtil');

        // 验证删除是否成功
        const deletedValue = await cacheManager.get(testKey);
        if (deletedValue === null || deletedValue === undefined) {
          LoggerUtil.info('✅ 缓存删除验证成功', 'CacheUtil');
          return true;
        } else {
          LoggerUtil.error('❌ 缓存删除验证失败', null, 'CacheUtil');
          return false;
        }
      } else {
        LoggerUtil.error('❌ 缓存读取测试失败', null, 'CacheUtil');
        LoggerUtil.error(`预期值: ${JSON.stringify(testValue)}`, null, 'CacheUtil');
        LoggerUtil.error(`实际值: ${JSON.stringify(retrievedValue)}`, null, 'CacheUtil');
        return false;
      }
    } catch (error) {
      LoggerUtil.error('❌ 缓存测试失败', error, 'CacheUtil');
      return false;
    }
  }

  /**
   * 详细的缓存诊断测试
   * @param cacheManager 缓存管理器
   */
  static async diagnosticTest(cacheManager: Cache): Promise<void> {
    LoggerUtil.info('🔬 开始缓存诊断测试...', 'CacheUtil');

    try {
      // 测试不同数据类型
      const tests = [
        { key: 'test_string', value: 'hello world', type: 'string' },
        { key: 'test_number', value: 42, type: 'number' },
        { key: 'test_object', value: { name: 'test', count: 1 }, type: 'object' },
        { key: 'test_array', value: [1, 2, 3], type: 'array' },
        { key: 'test_boolean', value: true, type: 'boolean' },
        { key: 'test_null', value: null, type: 'null' },
      ];

      for (const test of tests) {
        try {
          // 写入
          await cacheManager.set(test.key, test.value, 30000);

          // 读取
          const retrieved = await cacheManager.get(test.key);

          // 验证
          const isEqual = JSON.stringify(retrieved) === JSON.stringify(test.value);

          if (isEqual) {
            LoggerUtil.info(`✅ ${test.type} 类型测试成功`, 'CacheUtil');
          } else {
            LoggerUtil.error(`❌ ${test.type} 类型测试失败`, null, 'CacheUtil');
            LoggerUtil.error(`预期: ${JSON.stringify(test.value)}`, null, 'CacheUtil');
            LoggerUtil.error(`实际: ${JSON.stringify(retrieved)}`, null, 'CacheUtil');
          }

          // 清理
          await cacheManager.del(test.key);
        } catch (error) {
          LoggerUtil.error(`❌ ${test.type} 类型测试异常`, error, 'CacheUtil');
        }
      }

      // 测试TTL
      await this.testTTL(cacheManager);

      // 测试大数据
      await this.testLargeData(cacheManager);
    } catch (error) {
      LoggerUtil.error('❌ 缓存诊断测试失败', error, 'CacheUtil');
    }
  }

  /**
   * 测试TTL功能
   */
  private static async testTTL(cacheManager: Cache): Promise<void> {
    LoggerUtil.info('🕐 开始TTL测试...', 'CacheUtil');

    try {
      const key = 'ttl_test_key';
      const value = 'ttl_test_value';

      // 设置2秒过期
      await cacheManager.set(key, value, 2000);

      // 立即读取
      const immediate = await cacheManager.get(key);
      if (immediate === value) {
        LoggerUtil.info('✅ TTL立即读取测试成功', 'CacheUtil');
      } else {
        LoggerUtil.error('❌ TTL立即读取测试失败', null, 'CacheUtil');
      }

      // 等待3秒后读取
      LoggerUtil.info('⏳ 等待3秒测试TTL过期...', 'CacheUtil');
      await new Promise(resolve => setTimeout(resolve, 3000));

      const expired = await cacheManager.get(key);
      if (expired === null || expired === undefined) {
        LoggerUtil.info('✅ TTL过期测试成功', 'CacheUtil');
      } else {
        LoggerUtil.error('❌ TTL过期测试失败，缓存未过期', null, 'CacheUtil');
        LoggerUtil.error(`过期后的值: ${JSON.stringify(expired)}`, null, 'CacheUtil');
      }
    } catch (error) {
      LoggerUtil.error('❌ TTL测试失败', error, 'CacheUtil');
    }
  }

  /**
   * 测试大数据存储
   */
  private static async testLargeData(cacheManager: Cache): Promise<void> {
    LoggerUtil.info('📊 开始大数据测试...', 'CacheUtil');

    try {
      const key = 'large_data_test';
      const largeValue = {
        data: 'A'.repeat(1000), // 1KB数据
        timestamp: Date.now(),
        array: Array.from({ length: 100 }, (_, i) => ({ id: i, value: `item_${i}` })),
      };

      await cacheManager.set(key, largeValue, 10000);
      const retrieved = await cacheManager.get(key);

      if (retrieved && JSON.stringify(retrieved) === JSON.stringify(largeValue)) {
        LoggerUtil.info('✅ 大数据测试成功', 'CacheUtil');
      } else {
        LoggerUtil.error('❌ 大数据测试失败', null, 'CacheUtil');
      }

      await cacheManager.del(key);
    } catch (error) {
      LoggerUtil.error('❌ 大数据测试失败', error, 'CacheUtil');
    }
  }

  /**
   * 获取缓存统计信息
   * @param cacheManager 缓存管理器
   */
  static async getCacheStats(cacheManager: Cache): Promise<{
    status: string;
    timestamp: string;
    message?: string;
    storeType?: string;
    storeInfo?: Record<string, unknown>;
    error?: string;
  }> {
    try {
      // 获取底层存储信息
      const store = (cacheManager as any).store;
      const stats = {
        status: 'active',
        timestamp: new Date().toISOString(),
        message: '缓存统计信息获取成功',
        storeType: store?.constructor?.name || 'unknown',
        storeInfo: {} as Record<string, unknown>,
      };

      // 尝试获取 Redis 特定信息
      if (store && store.redis) {
        try {
          const redisStore = store as any;
          stats.storeInfo = {
            type: 'redis',
            connected: redisStore.redis.status === 'ready',
            status: redisStore.redis.status,
          };
        } catch {
          // 忽略错误
        }
      }

      return stats;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      LoggerUtil.error('获取缓存统计信息失败', error, 'CacheUtil');
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: errorMessage,
      };
    }
  }

  /**
   * 清除所有缓存
   * @param cacheManager 缓存管理器
   */
  static async clearAllCache(cacheManager: Cache): Promise<boolean> {
    try {
      const store = (cacheManager as any).store;

      // 尝试使用 store 的 clear 方法
      if (store && typeof store.clear === 'function') {
        const clearMethod = store.clear as () => Promise<void>;
        await clearMethod();
        LoggerUtil.info('✅ 使用store.clear()清除缓存成功', 'CacheUtil');
        return true;
      }

      // 如果没有 clear 方法，记录警告
      LoggerUtil.warn('⚠️ 当前缓存存储不支持批量清除', 'CacheUtil');
      return false;
    } catch (error) {
      LoggerUtil.error('清除缓存失败', error, 'CacheUtil');
      return false;
    }
  }

  /**
   * 测试缓存键是否存在
   * @param cacheManager 缓存管理器
   * @param key 键名
   */
  static async exists(cacheManager: Cache, key: string): Promise<boolean> {
    try {
      const value = await cacheManager.get(key);
      return value !== null && value !== undefined;
    } catch (error) {
      LoggerUtil.error(`检查键 ${key} 是否存在失败`, error, 'CacheUtil');
      return false;
    }
  }

  /**
   * 批量设置缓存
   * @param cacheManager 缓存管理器
   * @param entries 键值对数组
   * @param ttl 过期时间（毫秒）
   */
  static async setMany(
    cacheManager: Cache,
    entries: Array<{ key: string; value: unknown }>,
    ttl?: number,
  ): Promise<boolean> {
    try {
      const promises = entries.map(entry => cacheManager.set(entry.key, entry.value, ttl));

      await Promise.all(promises);
      LoggerUtil.info(`✅ 批量设置${entries.length}个缓存项成功`, 'CacheUtil');
      return true;
    } catch (error) {
      LoggerUtil.error('批量设置缓存失败', error, 'CacheUtil');
      return false;
    }
  }

  /**
   * 批量获取缓存
   * @param cacheManager 缓存管理器
   * @param keys 键名数组
   */
  static async getMany(cacheManager: Cache, keys: string[]): Promise<Record<string, unknown>> {
    try {
      const promises = keys.map(key => cacheManager.get(key).then(value => ({ key, value })));

      const results = await Promise.all(promises);
      const resultMap: Record<string, unknown> = {};

      results.forEach(({ key, value }) => {
        resultMap[key] = value;
      });

      LoggerUtil.info(`✅ 批量获取${keys.length}个缓存项成功`, 'CacheUtil');
      return resultMap;
    } catch (error) {
      LoggerUtil.error('批量获取缓存失败', error, 'CacheUtil');
      return {};
    }
  }

  /**
   * 批量删除缓存
   * @param cacheManager 缓存管理器
   * @param keys 键名数组
   */
  static async deleteMany(cacheManager: Cache, keys: string[]): Promise<boolean> {
    try {
      const promises = keys.map(key => cacheManager.del(key));
      await Promise.all(promises);
      LoggerUtil.info(`✅ 批量删除${keys.length}个缓存项成功`, 'CacheUtil');
      return true;
    } catch (error) {
      LoggerUtil.error('批量删除缓存失败', error, 'CacheUtil');
      return false;
    }
  }

  /**
   * 获取缓存健康状态
   * @param cacheManager 缓存管理器
   */
  static async getHealthStatus(cacheManager: Cache): Promise<CacheHealthStatus> {
    const startTime = Date.now();
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    let errorCount = 0;
    let lastError: string | undefined;

    try {
      // 测试基本读写操作
      const testKey = '__health_check__';
      const testValue = { timestamp: Date.now() };

      await cacheManager.set(testKey, testValue, 5000);
      const retrieved = await cacheManager.get(testKey);
      await cacheManager.del(testKey);

      if (!retrieved || JSON.stringify(retrieved) !== JSON.stringify(testValue)) {
        status = 'degraded';
        errorCount++;
        lastError = '缓存读写验证失败';
      }
    } catch (error) {
      status = 'unhealthy';
      errorCount++;
      lastError = error instanceof Error ? error.message : String(error);
      LoggerUtil.error('缓存健康检查失败', error, 'CacheUtil');
    }

    const responseTime = Date.now() - startTime;

    // 根据响应时间调整状态
    if (responseTime > 1000) {
      status = status === 'healthy' ? 'degraded' : status;
    }

    return {
      status,
      uptime: process.uptime(),
      errorCount,
      lastError,
      responseTime,
    };
  }

  /**
   * 创建缓存键的标准化方法
   * @param namespace 命名空间
   * @param module 模块名
   * @param identifier 标识符
   * @param suffix 后缀
   */
  static createKey(namespace: string, module: string, identifier: string, suffix?: string): string {
    const parts = [namespace, module, identifier];
    if (suffix) {
      parts.push(suffix);
    }
    return parts.join(':');
  }

  /**
   * 解析缓存键
   * @param key 缓存键
   */
  static parseKey(key: string): {
    namespace?: string;
    module?: string;
    identifier?: string;
    suffix?: string;
  } {
    const parts = key.split(':');
    return {
      namespace: parts[0] || undefined,
      module: parts[1] || undefined,
      identifier: parts[2] || undefined,
      suffix: parts[3] || undefined,
    };
  }

  /**
   * 获取缓存存储类型
   * @param cacheManager 缓存管理器
   */
  static getCacheStoreType(cacheManager: Cache): string {
    try {
      const store = (cacheManager as any).store;

      if (store?.constructor?.name) {
        return store.constructor.name;
      }

      // 尝试检测 Redis
      if (store && (store.redis || store.client)) {
        return 'Redis';
      }

      // 尝试检测 Keyv
      if (store && typeof store.set === 'function' && typeof store.get === 'function') {
        return 'Keyv';
      }

      return 'Memory';
    } catch (error) {
      LoggerUtil.error('获取缓存存储类型失败', error, 'CacheUtil');
      return 'Unknown';
    }
  }

  /**
   * 预热缓存
   * @param cacheManager 缓存管理器
   * @param entries 预热数据
   * @param ttl 过期时间
   */
  static async warmupCache(
    cacheManager: Cache,
    entries: Array<{ key: string; value: unknown }>,
    ttl?: number,
  ): Promise<void> {
    try {
      LoggerUtil.info(`🔥 开始预热缓存，共${entries.length}个项目...`, 'CacheUtil');

      const batchSize = 10; // 批量处理大小
      const batches: Array<{ key: string; value: unknown }[]> = [];

      for (let i = 0; i < entries.length; i += batchSize) {
        batches.push(entries.slice(i, i + batchSize));
      }

      let successCount = 0;
      let errorCount = 0;

      for (const batch of batches) {
        try {
          await this.setMany(cacheManager, batch, ttl);
          successCount += batch.length;
        } catch (error) {
          errorCount += batch.length;
          LoggerUtil.error(`批量预热失败，批次大小: ${batch.length}`, error, 'CacheUtil');
        }
      }

      LoggerUtil.info(`🔥 缓存预热完成 - 成功: ${successCount}, 失败: ${errorCount}`, 'CacheUtil');
    } catch (error) {
      LoggerUtil.error('缓存预热失败', error, 'CacheUtil');
    }
  }

  /**
   * 监控缓存性能
   * @param cacheManager 缓存管理器
   * @param operation 操作名称
   * @param fn 执行函数
   */
  static async monitorPerformance<T>(
    cacheManager: Cache,
    operation: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const startTime = Date.now();

    try {
      const result = await fn();
      const duration = Date.now() - startTime;

      LoggerUtil.info(`📊 缓存操作性能 - ${operation}: ${duration}ms`, 'CacheUtil');

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      LoggerUtil.error(`❌ 缓存操作失败 - ${operation}: ${duration}ms`, error, 'CacheUtil');
      throw error;
    }
  }
}
