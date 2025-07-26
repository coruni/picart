import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const noAuth = this.reflector.getAllAndOverride<boolean>('no-auth', [
      context.getHandler(),
      context.getClass(),
    ]);

    // 始终尝试执行JWT验证来解析用户信息
    try {
      const result = await super.canActivate(context);
      return result as boolean;
    } catch (err) {
      // 如果标记了@NoAuth()，即使JWT验证失败也允许通过
      if (noAuth) {
        return true;
      }
      // 如果没有标记@NoAuth()，抛出验证错误
      throw err;
    }
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext): any {
    const noAuth = this.reflector.getAllAndOverride<boolean>('no-auth', [
      context.getHandler(),
      context.getClass(),
    ]);
    
    // 如果标记了@NoAuth()，忽略错误，返回用户信息（可能为null）
    if (noAuth) {
      return user || null;
    }

    // 标准JWT验证逻辑
    if (err || !user) {
      throw err || new Error('Unauthorized');
    }
    
    return user;
  }
}