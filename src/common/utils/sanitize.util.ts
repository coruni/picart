import { User } from 'src/modules/user/entities/user.entity';

/**
 * 返回安全的用户信息（去除敏感字段）
 */
export function sanitizeUser(user: Partial<User> | null | undefined): any {
  if (!user) return null;
  const { id, username, nickname, avatar, status, roles, createdAt, updatedAt,description,followerCount,followingCount } = user;
  return {
    id,
    username,
    nickname,
    avatar,
    status,
    createdAt,
    updatedAt,
    description,
    followerCount,
    followingCount,
  };
}
