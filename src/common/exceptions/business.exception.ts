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
  constructor(message: string = 'response.error.unauthorized') {
    super(message, HttpStatus.UNAUTHORIZED);
  }
}

export class ForbiddenBusinessException extends BusinessException {
  constructor(message: string = 'response.error.permissionDenied') {
    super(message, HttpStatus.FORBIDDEN);
  }
}

export class NotFoundBusinessException extends BusinessException {
  constructor(message: string = 'response.error.resourceNotFound') {
    super(message, HttpStatus.NOT_FOUND);
  }
}

export class ConflictBusinessException extends BusinessException {
  constructor(message: string = 'response.error.resourceConflict') {
    super(message, HttpStatus.CONFLICT);
  }
}
