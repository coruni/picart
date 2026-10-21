import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { Request, Response } from "express";
import { LoggerUtil } from "../utils/logger.util";
import { sanitizeLogPayload } from "../utils/log-sanitize.util";

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const startTime = Date.now();

    const { method, url, ip, headers } = request;
    const userAgent = headers["user-agent"] || "";

    // 请求明细只在 debug 级别采集，且必须脱敏：body 里可能有密码/验证码
    if (LoggerUtil.isDebugEnabled()) {
      LoggerUtil.debug(`Request started: ${method} ${url}`, "HTTP", {
        ip,
        userAgent,
        body: sanitizeLogPayload(request.body),
        query: sanitizeLogPayload(request.query),
        params: sanitizeLogPayload(request.params),
      });
    }

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          LoggerUtil.info(
            `Request completed: ${method} ${url} - ${response.statusCode} - ${duration}ms`,
            "HTTP",
          );
        },
        error: (error: { status?: number }) => {
          const duration = Date.now() - startTime;
          const statusCode = error.status || 500;

          LoggerUtil.error(
            `Request failed: ${method} ${url} - ${statusCode} - ${duration}ms`,
            error,
            "HTTP",
          );
        },
      }),
    );
  }
}
