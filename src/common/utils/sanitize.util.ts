import { User } from "src/modules/user/entities/user.entity";

/**
 * 返回安全的用户信息（去除敏感字段）
 */
export function sanitizeUser(
  user: Partial<User & { isMember: boolean; equippedDecorations?: any }> | null | undefined,
): any {
  if (!user) return null;
  const {
    id,
    username,
    nickname,
    avatar,
    background,
    level,
    membershipLevel,
    membershipStatus,
    membershipStartDate,
    membershipEndDate,
    status,
    roles,
    createdAt,
    updatedAt,
    description,
    followerCount,
    followingCount,
    lastActiveAt,
    lastLoginAt,
    gender,
    isMember,
    equippedDecorations,
  } = user;
  return {
    id,
    username,
    nickname,
    avatar,
    background,
    level,
    membershipLevel,
    membershipStatus,
    membershipStartDate,
    membershipEndDate,
    status,
    createdAt,
    updatedAt,
    description,
    followerCount,
    followingCount,
    roles,
    lastActiveAt,
    lastLoginAt,
    gender,
    isMember,
    ...(equippedDecorations && { equippedDecorations }),
  };
}
