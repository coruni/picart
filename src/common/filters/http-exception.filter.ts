import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Request, Response } from "express";

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

    const exceptionResponse = exception.getResponse() as ExceptionResponse;

    // 处理不同类型的错误消息
    let message = exception.message;
    if (Array.isArray(exceptionResponse.message)) {
      // 处理验证错误（400）
      if (status === HttpStatus.BAD_REQUEST) {
        message = exceptionResponse.message[0];
      }
    } else if (typeof exceptionResponse.message === "string") {
      message = exceptionResponse.message;
    } else {
      // 处理其他状态码的默认消息
      switch (status) {
        case HttpStatus.UNAUTHORIZED:
          message = "response.error.userNotLogin";
          break;
        case HttpStatus.FORBIDDEN:
          message = "response.error.permissionDenied";
          break;
        case HttpStatus.NOT_FOUND:
          message = "response.error.resourceNotFound";
          break;
        case HttpStatus.CONFLICT:
          message = "response.error.resourceConflict";
          break;
        // 可以继续添加其他状态码的处理
      }
    }

    const errorResponse = {
      code: status,
      message: message || "response.error.serverError",
      data: null,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(status).json(errorResponse);
  }
}
