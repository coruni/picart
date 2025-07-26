import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const noAuth = this.reflector.getAllAndOverride<boolean>('no-auth', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (noAuth) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest(err, user, info, context) {
    const noAuth = this.reflector.getAllAndOverride<boolean>('no-auth', [
      context.getHandler(),
      context.getClass(),
    ]);
    
    if (noAuth && !user) {
      return null;
    }

    return super.handleRequest(err, user, info, context);
  }
}