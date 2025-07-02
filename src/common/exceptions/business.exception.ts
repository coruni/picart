import { HttpException, HttpStatus } from '@nestjs/common';

export class BusinessException extends HttpException {
  constructor(message: string, code: number = HttpStatus.BAD_REQUEST) {
    super(
      {
        code,
        message,
        data: null,
        timestamp: Date.now(),
      },
      code,
    );
  }
}

export class UnauthorizedBusinessException extends BusinessException {
  constructor(message: string = '未授权访问') {
    super(message, HttpStatus.UNAUTHORIZED);
  }
}

export class ForbiddenBusinessException extends BusinessException {
  constructor(message: string = '权限不足') {
    super(message, HttpStatus.FORBIDDEN);
  }
}

export class NotFoundBusinessException extends BusinessException {
  constructor(message: string = '资源不存在') {
    super(message, HttpStatus.NOT_FOUND);
  }
}

export class ConflictBusinessException extends BusinessException {
  constructor(message: string = '资源冲突') {
    super(message, HttpStatus.CONFLICT);
  }
} 