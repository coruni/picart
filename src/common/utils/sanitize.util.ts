import { User } from "src/modules/user/entities/user.entity";

/**
 * 检查用户会员状态
 * 仅根据 membershipStatus 和会员有效期判断，不依赖 membershipLevel
 */
export function checkMembershipStatus(
  user: Pick<User, "membershipStatus" | "membershipEndDate">,
): boolean {
  try {
    return (
      user.membershipStatus === "ACTIVE" &&
      (user.membershipEndDate === null || user.membershipEndDate > new Date())
    );
  } catch (error) {
    console.error("检查会员状态失败:", error);
    return false;
  }
}

/**
 * 返回安全的用户信息（去除敏感字段）
 */
export function sanitizeUser(
  user:
    | Partial<User & { isMember: boolean; equippedDecorations?: any }>
    | null
    | undefined,
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

/**
 * 移除 HTML 中潜在嵌入的 script 标签内容。
 * 保留其他原有 HTML 结构，避免影响前端已有渲染逻辑。
 */
export function stripScriptTags(content?: string | null): string | undefined {
  if (typeof content !== "string") {
    return content === null ? undefined : content;
  }

  return content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gis, "")
    .trim();
}
