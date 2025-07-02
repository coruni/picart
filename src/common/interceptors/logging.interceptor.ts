import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { LoggerUtil } from '../utils/logger.util';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const startTime = Date.now();

    const { method, url, ip, headers } = request;
    const userAgent = headers['user-agent'] || '';

    // 记录请求开始
    LoggerUtil.info(
      `Request started: ${method} ${url}`,
      'HTTP',
      {
        ip,
        userAgent,
        body: request.body,
        query: request.query,
        params: request.params,
      }
    );

    return next.handle().pipe(
      tap({
        next: (data) => {
          const duration = Date.now() - startTime;
          const statusCode = response.statusCode;

          // 记录请求完成
          LoggerUtil.info(
            `Request completed: ${method} ${url} - ${statusCode} - ${duration}ms`,
            'HTTP',
            { responseData: data }
          );
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          const statusCode = error.status || 500;

          // 记录请求错误
          LoggerUtil.error(
            `Request failed: ${method} ${url} - ${statusCode} - ${duration}ms`,
            error,
            'HTTP'
          );
        },
      }),
    );
  }
} 