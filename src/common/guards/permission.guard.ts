import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { User } from 'src/modules/user/entities/user.entity';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredPermissions || requiredPermissions.length === 0) {
      // 没有声明权限，直接放行（只要登录即可）
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: User = request.user;
    if (!user) {
      throw new UnauthorizedException('response.error.userNotLogin');
    }
    const userPermissions =
      user.roles?.flatMap((role) => role.permissions).map((p) => p.name) || [];

    const hasPermission = requiredPermissions.some((perm) => userPermissions.includes(perm));
    if (!hasPermission) {
      throw new ForbiddenException('权限不足');
    }
    return true;
  }
}
