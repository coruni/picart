import { User } from "src/modules/user/entities/user.entity";

/**
 * 返回安全的用户信息（去除敏感字段）
 */
export function sanitizeUser(
  user: Partial<User & { isMember: boolean; equippedDecorations?: any }> | null | undefined,
): any {
  if (!user) return null;
  
  // 使用解构排除敏感字段
  const {
    password,
    email,
    phone,
    address,
    refreshToken,
    resetPasswordToken,
    resetPasswordExpires,
    emailVerificationToken,
    emailVerified,
    phoneVerified,
    twoFactorSecret,
    twoFactorEnabled,
    ...safeUser
  } = user as any;
  
  return safeUser;
}
