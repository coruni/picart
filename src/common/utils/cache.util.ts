import { Cache } from "cache-manager";
import { LoggerUtil } from "./logger.util";

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
  status: "healthy" | "degraded" | "unhealthy";
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
      const testKey = "cache_test_key";
      const testValue = { message: "缓存测试", timestamp: Date.now() };

      LoggerUtil.info("开始缓存测试...", "CacheUtil");

      // 写入测试数据
      await cacheManager.set(testKey, testValue, 60000); // 1分钟过期
      LoggerUtil.info("缓存写入测试成功", "CacheUtil");

      // 立即读取测试数据
      const retrievedValue = await cacheManager.get(testKey);
      LoggerUtil.info(
        `缓存读取结果: ${retrievedValue ? JSON.stringify(retrievedValue) : "null"}`,
        "CacheUtil",
      );

      if (
        retrievedValue &&
        JSON.stringify(retrievedValue) === JSON.stringify(testValue)
      ) {
        LoggerUtil.info("缓存读取测试成功", "CacheUtil");

        // 测试缓存是否真的存在
        const exists = await cacheManager.get(testKey);
        if (exists) {
          LoggerUtil.info("缓存持久性测试成功", "CacheUtil");
        } else {
          LoggerUtil.error("缓存持久性测试失败", undefined, "CacheUtil");
        }

        // 清理测试数据
        await cacheManager.del(testKey);
        LoggerUtil.info("缓存删除测试成功", "CacheUtil");

        // 验证删除是否成功
        const deletedValue = await cacheManager.get(testKey);
        if (deletedValue === null || deletedValue === undefined) {
          LoggerUtil.info("缓存删除验证成功", "CacheUtil");
          return true;
        } else {
          LoggerUtil.error("缓存删除验证失败", undefined, "CacheUtil");
          return false;
        }
      } else {
        LoggerUtil.error("缓存读取测试失败", undefined, "CacheUtil");
        LoggerUtil.error(
          `预期值: ${JSON.stringify(testValue)}`,
          null,
          "CacheUtil",
        );
        LoggerUtil.error(
          `实际值: ${JSON.stringify(retrievedValue)}`,
          null,
          "CacheUtil",
        );
        return false;
      }
    } catch (error) {
      LoggerUtil.error("缓存测试失败", error, "CacheUtil");
      return false;
    }
  }

  /**
   * 详细的缓存诊断测试
   * @param cacheManager 缓存管理器
   */
  static async diagnosticTest(cacheManager: Cache): Promise<void> {
    LoggerUtil.info("开始缓存诊断测试...", "CacheUtil");

    try {
      // 测试不同数据类型
      const tests = [
        { key: "test_string", value: "hello world", type: "string" },
        { key: "test_number", value: 42, type: "number" },
        {
          key: "test_object",
          value: { name: "test", count: 1 },
          type: "object",
        },
        { key: "test_array", value: [1, 2, 3], type: "array" },
        { key: "test_boolean", value: true, type: "boolean" },
        { key: "test_null", value: null, type: "null" },
      ];

      for (const test of tests) {
        try {
          // 写入
          await cacheManager.set(test.key, test.value, 30000);

          // 读取
          const retrieved = await cacheManager.get(test.key);

          // 验证
          const isEqual =
            JSON.stringify(retrieved) === JSON.stringify(test.value);

          if (isEqual) {
            LoggerUtil.info(`${test.type} 类型测试成功`, "CacheUtil");
          } else {
            LoggerUtil.error(`${test.type} 类型测试失败`, undefined, "CacheUtil");
            LoggerUtil.error(
              `预期: ${JSON.stringify(test.value)}`,
              null,
              "CacheUtil",
            );
            LoggerUtil.error(
              `实际: ${JSON.stringify(retrieved)}`,
              null,
              "CacheUtil",
            );
          }

          // 清理
          await cacheManager.del(test.key);
        } catch (error) {
          LoggerUtil.error(`${test.type} 类型测试异常`, error, "CacheUtil");
        }
      }

      // 测试TTL
      await this.testTTL(cacheManager);

      // 测试大数据
      await this.testLargeData(cacheManager);
    } catch (error) {
      LoggerUtil.error("缓存诊断测试失败", error, "CacheUtil");
    }
  }

  /**
   * 测试TTL功能
   */
  private static async testTTL(cacheManager: Cache): Promise<void> {
    LoggerUtil.info("开始TTL测试...", "CacheUtil");

    try {
      const key = "ttl_test_key";
      const value = "ttl_test_value";

      // 设置2秒过期
      await cacheManager.set(key, value, 2000);

      // 立即读取
      const immediate = await cacheManager.get(key);
      if (immediate === value) {
        LoggerUtil.info("TTL立即读取测试成功", "CacheUtil");
      } else {
        LoggerUtil.error("TTL立即读取测试失败", undefined, "CacheUtil");
      }

      // 等待3秒后读取
      LoggerUtil.info("⏳ 等待3秒测试TTL过期...", "CacheUtil");
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const expired = await cacheManager.get(key);
      if (expired === null || expired === undefined) {
        LoggerUtil.info("TTL过期测试成功", "CacheUtil");
      } else {
        LoggerUtil.error("TTL过期测试失败，缓存未过期", undefined, "CacheUtil");
        LoggerUtil.error(
          `过期后的值: ${JSON.stringify(expired)}`,
          null,
          "CacheUtil",
        );
      }
    } catch (error) {
      LoggerUtil.error("TTL测试失败", error, "CacheUtil");
    }
  }

  /**
   * 测试大数据存储
   */
  private static async testLargeData(cacheManager: Cache): Promise<void> {
    LoggerUtil.info("开始大数据测试...", "CacheUtil");

    try {
      const key = "large_data_test";
      const largeValue = {
        data: "A".repeat(1000), // 1KB数据
        timestamp: Date.now(),
        array: Array.from({ length: 100 }, (_, i) => ({
          id: i,
          value: `item_${i}`,
        })),
      };

      await cacheManager.set(key, largeValue, 10000);
      const retrieved = await cacheManager.get(key);

      if (
        retrieved &&
        JSON.stringify(retrieved) === JSON.stringify(largeValue)
      ) {
        LoggerUtil.info("大数据测试成功", "CacheUtil");
      } else {
        LoggerUtil.error("大数据测试失败", undefined, "CacheUtil");
      }

      await cacheManager.del(key);
    } catch (error) {
      LoggerUtil.error("大数据测试失败", error, "CacheUtil");
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
        status: "active",
        timestamp: new Date().toISOString(),
        message: "缓存统计信息获取成功",
        storeType: store?.constructor?.name || "unknown",
        storeInfo: {} as Record<string, unknown>,
      };

      // 尝试获取 Redis 特定信息
      if (store && store.redis) {
        try {
          const redisStore = store;
          stats.storeInfo = {
            type: "redis",
            connected: redisStore.redis.status === "ready",
            status: redisStore.redis.status,
          };
        } catch {
          // 忽略错误
        }
      }

      return stats;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      LoggerUtil.error("获取缓存统计信息失败", error, "CacheUtil");
      return {
        status: "error",
        timestamp: new Date().toISOString(),
        error: errorMessage,
      };
    }
  }
}
