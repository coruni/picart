import { HttpException, HttpStatus } from '@nestjs/common';

export class TooManyRequestException extends HttpException {
  constructor(message: string = '请求过于频繁，请稍后再试') {
    super(
      {
        code: HttpStatus.TOO_MANY_REQUESTS,
        message,
        data: null,
        timestamp: Date.now(),
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
