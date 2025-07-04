import { Logger } from '@nestjs/common';

export class LoggerUtil {
  private static logger = new Logger();

  /**
   * 记录信息日志
   * @param message 日志消息
   * @param context 上下文
   * @param data 额外数据
   */
  static info(message: string, context?: string, data?: unknown) {
    this.logger.log(message, context);
    if (data) {
      this.logger.log(JSON.stringify(data, null, 2), context);
    }
  }

  /**
   * 记录错误日志
   * @param message 错误消息
   * @param error 错误对象
   * @param context 上下文
   */
  static error(message: string, error?: unknown, context?: string) {
    const errorStack = error instanceof Error ? error.stack : String(error);
    this.logger.error(message, errorStack, context);
  }

  /**
   * 记录警告日志
   * @param message 警告消息
   * @param context 上下文
   */
  static warn(message: string, context?: string) {
    this.logger.warn(message, context);
  }

  /**
   * 记录调试日志
   * @param message 调试消息
   * @param context 上下文
   * @param data 额外数据
   */
  static debug(message: string, context?: string, data?: unknown) {
    this.logger.debug(message, context);
    if (data) {
      this.logger.debug(JSON.stringify(data, null, 2), context);
    }
  }

  /**
   * 记录 API 请求日志
   * @param method HTTP 方法
   * @param url 请求 URL
   * @param ip 客户端 IP
   * @param userAgent 用户代理
   * @param duration 请求耗时
   */
  static logApiRequest(
    method: string,
    url: string,
    ip: string,
    userAgent: string,
    duration: number,
  ) {
    this.info(`${method} ${url} - ${ip} - ${duration}ms`, 'API', { userAgent });
  }

  /**
   * 记录数据库操作日志
   * @param operation 操作类型
   * @param table 表名
   * @param duration 操作耗时
   * @param context 上下文
   */
  static logDatabase(operation: string, table: string, duration: number, context?: string) {
    this.debug(`${operation} on ${table} - ${duration}ms`, context || 'Database');
  }

  /**
   * 记录用户操作日志
   * @param userId 用户ID
   * @param action 操作
   * @param details 详细信息
   */
  static logUserAction(userId: number, action: string, details?: unknown) {
    this.info(`User ${userId} performed ${action}`, 'UserAction', details);
  }
}
