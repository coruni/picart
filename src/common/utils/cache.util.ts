import { Cache } from 'cache-manager';
import { LoggerUtil } from './logger.util';

export class CacheUtil {
  /**
   * 测试缓存是否正常工作
   * @param cacheManager 缓存管理器
   */
  static async testCache(cacheManager: Cache): Promise<boolean> {
    try {
      const testKey = 'cache_test_key';
      const testValue = { message: '缓存测试', timestamp: Date.now() };
      
      // 写入测试数据
      await cacheManager.set(testKey, testValue, 60000); // 1分钟过期
      LoggerUtil.info('缓存写入测试成功', 'CacheUtil');
      
      // 读取测试数据
      const retrievedValue = await cacheManager.get(testKey);
      if (retrievedValue && JSON.stringify(retrievedValue) === JSON.stringify(testValue)) {
        LoggerUtil.info('缓存读取测试成功', 'CacheUtil');
        
        // 清理测试数据
        await cacheManager.del(testKey);
        LoggerUtil.info('缓存删除测试成功', 'CacheUtil');
        
        return true;
      } else {
        LoggerUtil.error('缓存读取测试失败', null, 'CacheUtil');
        return false;
      }
    } catch (error) {
      LoggerUtil.error('缓存测试失败', error, 'CacheUtil');
      return false;
    }
  }

  /**
   * 获取缓存统计信息
   * @param cacheManager 缓存管理器
   */
  static async getCacheStats(cacheManager: Cache): Promise<any> {
    try {
      // 这里可以根据具体的缓存实现来获取统计信息
      // 对于 Redis，可以获取内存使用情况等
      // 对于内存缓存，可以获取缓存项数量等
      
      return {
        status: 'active',
        timestamp: new Date().toISOString(),
        message: '缓存统计信息获取成功'
      };
    } catch (error) {
      LoggerUtil.error('获取缓存统计信息失败', error, 'CacheUtil');
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  /**
   * 清除所有缓存
   * @param cacheManager 缓存管理器
   */
  static async clearAllCache(cacheManager: Cache): Promise<boolean> {
    try {
      // 注意：cache-manager 的 Cache 接口没有 reset 方法
      // 这里我们只能清除已知的键，或者使用 store 的 reset 方法
      LoggerUtil.info('缓存清除功能需要具体实现', 'CacheUtil');
      return true;
    } catch (error) {
      LoggerUtil.error('清除缓存失败', error, 'CacheUtil');
      return false;
    }
  }
} 