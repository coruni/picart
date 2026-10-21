/**
 * 缓存键唯一来源。
 *
 * 历史问题：写入用 `user:{id}:device:{deviceId}:token`，清除却删 `user:{id}:token`，
 * 两处各自拼字符串导致登出无法失效设备 token。所有读写必须走这里。
 */
export const CacheKeys = {
  /** 单设备（无 deviceId）access token */
  userToken: (userId: number): string => `user:${userId}:token`,

  /** 单设备（无 deviceId）refresh token */
  userRefreshToken: (userId: number): string => `user:${userId}:refresh`,

  /** 多设备 access token */
  userDeviceToken: (userId: number, deviceId: string): string =>
    `user:${userId}:device:${deviceId}:token`,

  /** 多设备 refresh token */
  userDeviceRefreshToken: (userId: number, deviceId: string): string =>
    `user:${userId}:device:${deviceId}:refresh`,

  /** 鉴权用用户快照（含权限） */
  authUser: (userId: number): string => `auth:user:${userId}:permissions`,

  /** 站点名称等公共配置 */
  siteName: (): string => "site_name",
} as const;
