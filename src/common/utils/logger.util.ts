import { Logger, LogLevel } from "@nestjs/common";

export class LoggerUtil {
  private static logger = new Logger();

  private static isEnabled(level: LogLevel): boolean {
    return Logger.isLevelEnabled(level);
  }

  /**
   * 把附加数据拼到消息同一行，避免多行日志破坏结构化采集。
   */
  private static compose(message: string, data?: unknown): string {
    if (data === undefined || data === null) {
      return message;
    }

    let serialized: string;
    try {
      serialized = JSON.stringify(data);
    } catch {
      serialized = String(data);
    }

    return `${message} ${serialized}`;
  }

  /**
   * 记录信息日志
   * @param message 日志消息
   * @param context 上下文
   * @param data 额外数据
   */
  static info(message: string, context?: string, data?: unknown) {
    if (!this.isEnabled("log")) {
      return;
    }
    this.logger.log(this.compose(message, data), context);
  }

  /**
   * 记录错误日志
   * @param message 错误消息
   * @param error 错误对象
   * @param context 上下文
   */
  static error(message: string, error?: unknown, context?: string) {
    if (!this.isEnabled("error")) {
      return;
    }
    const errorStack = error instanceof Error ? error.stack : String(error);
    this.logger.error(message, errorStack, context);
  }

  /**
   * 记录警告日志
   * @param message 警告消息
   * @param context 上下文
   */
  static warn(message: string, context?: string) {
    if (!this.isEnabled("warn")) {
      return;
    }
    this.logger.warn(message, context);
  }

  /**
   * 记录调试日志
   * @param message 调试消息
   * @param context 上下文
   * @param data 额外数据
   */
  static debug(message: string, context?: string, data?: unknown) {
    if (!this.isEnabled("debug")) {
      return;
    }
    this.logger.debug(this.compose(message, data), context);
  }

  /**
   * 供调用方判断是否需要构造昂贵的日志数据（如请求体脱敏）。
   */
  static isDebugEnabled(): boolean {
    return this.isEnabled("debug");
  }
}
