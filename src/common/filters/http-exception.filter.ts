import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ExceptionResponse {
  message?: string | string[];
  error?: string;
  statusCode?: number;
}

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();

    // 获取异常响应
    const exceptionResponse = exception.getResponse() as ExceptionResponse;

    // 处理验证错误
    let message = exception.message;
    if (status === HttpStatus.BAD_REQUEST && Array.isArray(exceptionResponse.message)) {
      message = exceptionResponse.message[0];
    } else if (typeof exceptionResponse.message === 'string') {
      message = exceptionResponse.message;
    }

    const errorResponse = {
      code: status,
      message: message || '服务器内部错误',
      data: null,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(HttpStatus.OK).json(errorResponse);
  }
}
