import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Request, Response } from "express";
import { LoggerUtil } from "../utils/logger.util";

interface ExceptionResponse {
  code?: number;
  message?: string | string[];
  error?: string;
  statusCode?: number;
}

const DEFAULT_MESSAGE_BY_STATUS: Record<number, string> = {
  [HttpStatus.UNAUTHORIZED]: "response.error.userNotLogin",
  [HttpStatus.FORBIDDEN]: "response.error.permissionDenied",
  [HttpStatus.NOT_FOUND]: "response.error.resourceNotFound",
  [HttpStatus.CONFLICT]: "response.error.resourceConflict",
};

/**
 * 统一异常响应。
 *
 * - `@Catch()` 兜底所有异常，未知错误也返回同一结构并记录堆栈。
 * - 优先使用异常自带的 `code`（BusinessException 会带业务码），而不是一律用 HTTP status。
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const timestamp = new Date().toISOString();

    if (!(exception instanceof HttpException)) {
      LoggerUtil.error(
        `Unhandled exception on ${request.method} ${request.url}`,
        exception,
        "HttpExceptionFilter",
      );

      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        code: HttpStatus.INTERNAL_SERVER_ERROR,
        message: "response.error.serverError",
        data: null,
        timestamp,
        path: request.url,
      });
      return;
    }

    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse() as ExceptionResponse;

    const code =
      typeof exceptionResponse?.code === "number"
        ? exceptionResponse.code
        : status;

    response.status(status).json({
      code,
      message: this.resolveMessage(exception, exceptionResponse, status),
      data: null,
      timestamp,
      path: request.url,
    });
  }

  private resolveMessage(
    exception: HttpException,
    exceptionResponse: ExceptionResponse,
    status: number,
  ): string {
    if (Array.isArray(exceptionResponse?.message)) {
      // 参数校验错误只返回第一条，保持既有交互
      return exceptionResponse.message[0] ?? DEFAULT_MESSAGE_BY_STATUS[status] ?? exception.message;
    }

    if (typeof exceptionResponse?.message === "string") {
      return exceptionResponse.message;
    }

    return (
      DEFAULT_MESSAGE_BY_STATUS[status] ??
      exception.message ??
      "response.error.serverError"
    );
  }
}
