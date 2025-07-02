import { ConfigService } from '@nestjs/config';
import * as winston from 'winston';
import * as DailyRotateFile from 'winston-daily-rotate-file';

export const loggerConfig = (configService: ConfigService) => {
  const isProduction = configService.get('NODE_ENV') === 'production';
  
  // 日志格式
  const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  );

  // 控制台格式
  const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, context, trace }) => {
      return `${timestamp} [${context}] ${level}: ${message}${trace ? `\n${trace}` : ''}`;
    }),
  );

  // 文件传输配置
  const fileTransports = [
    // 错误日志
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '14d',
      format: logFormat,
    }),
    // 所有日志
    new DailyRotateFile({
      filename: 'logs/combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      format: logFormat,
    }),
  ];

  // 开发环境添加控制台输出
  const transports = isProduction 
    ? fileTransports 
    : [
        new winston.transports.Console({
          format: consoleFormat,
        }),
        ...fileTransports,
      ];

  return {
    transports,
    level: isProduction ? 'info' : 'debug',
    format: logFormat,
  };
}; 