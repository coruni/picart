/**
 * 为用户对象添加装饰品信息的辅助函数
 * 
 * 注意：这个函数需要在有 DecorationService 的上下文中使用
 * 或者在调用前手动获取装饰品信息
 */

/**
 * 为用户添加装饰品信息
 * @param user 用户对象
 * @param decorationService 装饰品服务实例
 * @returns 包含装饰品信息的用户对象
 */
export async function addUserDecorations(
  user: any,
  decorationService: any,
): Promise<any> {
  if (!user || !user.id) return user;

  try {
    const equippedDecorations = await decorationService.getUserEquippedDecorations(user.id);
    return {
      ...user,
      equippedDecorations,
    };
  } catch (error) {
    console.error('获取用户装饰品失败:', error);
    return user;
  }
}

/**
 * 批量为用户添加装饰品信息
 * @param users 用户对象数组
 * @param decorationService 装饰品服务实例
 * @returns 包含装饰品信息的用户对象数组
 */
export async function addUsersDecorations(
  users: any[],
  decorationService: any,
): Promise<any[]> {
  if (!users || users.length === 0) return users;

  try {
    // 批量获取所有用户的装饰品
    const userIds = users.map(u => u.id).filter(Boolean);
    const decorationsMap = new Map();

    // 并行获取所有用户的装饰品
    await Promise.all(
      userIds.map(async (userId) => {
        try {
          const decorations = await decorationService.getUserEquippedDecorations(userId);
          decorationsMap.set(userId, decorations);
        } catch (error) {
          console.error(`获取用户 ${userId} 装饰品失败:`, error);
        }
      })
    );

    // 为每个用户添加装饰品信息
    return users.map(user => {
      if (!user || !user.id) return user;
      const equippedDecorations = decorationsMap.get(user.id);
      return equippedDecorations ? { ...user, equippedDecorations } : user;
    });
  } catch (error) {
    console.error('批量获取用户装饰品失败:', error);
    return users;
  }
}

/**
 * 处理用户装饰品关系数据，转换为前端友好的格式
 * @param user 包含 userDecorations 关系的用户对象
 * @returns 包含 equippedDecorations 的用户对象
 */
export function processUserDecorations(user: any): any {
  if (!user) return user;

  // 如果用户没有 userDecorations 关系，直接返回
  if (!user.userDecorations || !Array.isArray(user.userDecorations)) {
    return user;
  }

  // 过滤出正在使用的装饰品，并按类型分组
  const equippedDecorations: Record<string, any> = {};
  
  user.userDecorations
    .filter((userDec: any) => userDec.isUsing && userDec.decoration)
    .forEach((userDec: any) => {
      const decoration = userDec.decoration;
      equippedDecorations[decoration.type] = {
        id: decoration.id,
        name: decoration.name,
        type: decoration.type,
        imageUrl: decoration.imageUrl,
        rarity: decoration.rarity,
      };
    });

  // 移除 userDecorations 关系，添加 equippedDecorations
  const { userDecorations, ...userWithoutDecorations } = user;
  
  return {
    ...userWithoutDecorations,
    equippedDecorations: Object.keys(equippedDecorations).length > 0 ? equippedDecorations : undefined,
  };
}

/**
 * 批量处理用户装饰品关系数据
 * @param users 包含 userDecorations 关系的用户对象数组
 * @returns 包含 equippedDecorations 的用户对象数组
 */
export function processUsersDecorations(users: any[]): any[] {
  if (!users || users.length === 0) return users;
  return users.map(user => processUserDecorations(user));
}
