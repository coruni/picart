import { Repository } from "typeorm";
import { UserBlock } from "../../modules/user/entities/user-block.entity";

/**
 * 批量获取拉黑状态
 * @param userBlockRepository UserBlock 仓储
 * @param currentUserId 当前用户ID
 * @param targetUserIds 目标用户ID列表
 * @returns Set<number> 被当前用户拉黑的用户ID集合
 */
export async function getBlockedUserIdSet(
  userBlockRepository: Repository<UserBlock>,
  currentUserId: number,
  targetUserIds: number[],
): Promise<Set<number>> {
  if (!currentUserId || targetUserIds.length === 0) {
    return new Set<number>();
  }

  const blocks = await userBlockRepository
    .createQueryBuilder("block")
    .where("block.userId = :userId", { userId: currentUserId })
    .andWhere("block.blockedUserId IN (:...targetUserIds)", { targetUserIds })
    .select(["block.blockedUserId"])
    .getMany();

  return new Set(blocks.map((b) => b.blockedUserId));
}

/**
 * 检查是否拉黑了某个用户
 * @param userBlockRepository UserBlock 仓储
 * @param currentUserId 当前用户ID
 * @param targetUserId 目标用户ID
 * @returns boolean 是否拉黑
 */
export async function isBlockedUser(
  userBlockRepository: Repository<UserBlock>,
  currentUserId: number,
  targetUserId: number,
): Promise<boolean> {
  if (!currentUserId || !targetUserId || currentUserId === targetUserId) {
    return false;
  }

  const count = await userBlockRepository.count({
    where: {
      userId: currentUserId,
      blockedUserId: targetUserId,
    },
  });

  return count > 0;
}

/**
 * 为单个用户添加拉黑状态
 * @param user 用户对象
 * @param isBlocked 是否被拉黑
 * @returns 包含 isBlocked 的用户对象
 */
export function addBlockStatusToUser<T extends { id?: number }>(
  user: T,
  isBlocked: boolean,
): T & { isBlocked: boolean } {
  return {
    ...user,
    isBlocked,
  };
}

/**
 * 批量为用户添加拉黑状态
 * @param users 用户对象数组
 * @param blockedUserIds 被拉黑的用户ID集合
 * @returns 包含 isBlocked 的用户对象数组
 */
export function addBlockStatusToUsers<T extends { id?: number }>(
  users: T[],
  blockedUserIds: Set<number>,
): (T & { isBlocked: boolean })[] {
  return users.map((user) => ({
    ...user,
    isBlocked: user.id ? blockedUserIds.has(user.id) : false,
  }));
}
