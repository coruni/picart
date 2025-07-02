import { User } from '../../modules/user/entities/user.entity';

export class PermissionUtil {
  /**
   * 检查用户是否有指定权限
   * @param user 用户对象
   * @param permission 权限名称
   * @returns boolean
   */
  static hasPermission(user: User, permission: string): boolean {
    // 超级管理员拥有所有权限
    if (user.roles.some(role => role.name === 'super-admin')) {
      return true;
    }

    return user.roles.some(role =>
      role.permissions.some(p => p.name === permission)
    );
  }

  /**
   * 检查用户是否有指定角色
   * @param user 用户对象
   * @param roleName 角色名称
   * @returns boolean
   */
  static hasRole(user: User, roleName: string): boolean {
    return user.roles.some(role => role.name === roleName);
  }

  /**
   * 检查用户是否有任意一个指定权限
   * @param user 用户对象
   * @param permissions 权限名称数组
   * @returns boolean
   */
  static hasAnyPermission(user: User, permissions: string[]): boolean {
    // 超级管理员拥有所有权限
    if (user.roles.some(role => role.name === 'super-admin')) {
      return true;
    }

    return user.roles.some(role =>
      role.permissions.some(p => permissions.includes(p.name))
    );
  }

  /**
   * 检查用户是否有任意一个指定角色
   * @param user 用户对象
   * @param roleNames 角色名称数组
   * @returns boolean
   */
  static hasAnyRole(user: User, roleNames: string[]): boolean {
    return user.roles.some(role => roleNames.includes(role.name));
  }
} 