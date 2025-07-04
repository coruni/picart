// 用户相关常量
export const USER_CONSTANTS = {
  DEFAULT_ROLE: 'user',
  SUPER_ADMIN_ROLE: 'super-admin',
  STATUS: {
    ACTIVE: 'ACTIVE',
    INACTIVE: 'INACTIVE',
    BANNED: 'BANNED',
  },
  GENDER: {
    MALE: 'male',
    FEMALE: 'female',
    OTHER: 'other',
  },
} as const;

// 权限相关常量
export const PERMISSION_CONSTANTS = {
  USER_MANAGE: 'user:manage',
  ARTICLE_CREATE: 'article:create',
  ARTICLE_EDIT: 'article:edit',
  ARTICLE_DELETE: 'article:delete',
  COMMENT_CREATE: 'comment:create',
  COMMENT_EDIT: 'comment:edit',
  COMMENT_DELETE: 'comment:delete',
  COMMENT_MANAGE: 'comment:manage',
} as const;

// 评论相关常量
export const COMMENT_CONSTANTS = {
  STATUS: {
    PUBLISHED: 'PUBLISHED',
    DRAFT: 'DRAFT',
    DELETED: 'DELETED',
    REJECTED: 'REJECTED',
  },
} as const;

// 分页相关常量
export const PAGINATION_CONSTANTS = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
} as const;

// JWT 相关常量
export const JWT_CONSTANTS = {
  ACCESS_TOKEN_EXPIRES_IN: '1h',
  REFRESH_TOKEN_EXPIRES_IN: '7d',
} as const;

// 缓存相关常量
export const CACHE_CONSTANTS = {
  DEFAULT_TTL: 5000,
  DEFAULT_MAX: 100,
  MEMORY_TTL: 60000,
  MEMORY_SIZE: 5000,
} as const;
