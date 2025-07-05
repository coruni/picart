# 统一列表返回数据体指南

## 概述

本项目已实现统一的列表返回数据体，确保所有列表接口返回格式一致，便于前端处理和维护。

## 核心接口定义

### 1. 基础响应接口

```typescript
// 基础响应接口
export interface BaseResponse<T = any> {
  code: number;
  message: string;
  data: T;
  timestamp: number;
}

// 分页响应接口
export interface PaginatedResponse<T = any> {
  code: number;
  message: string;
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  timestamp: number;
}

// 列表响应接口（不分页）
export interface ListResponse<T = any> {
  code: number;
  message: string;
  data: T[];
  timestamp: number;
}
```

### 2. 统一列表返回数据体

```typescript
// 统一列表返回数据体
export interface ListResult<T = any> {
  data: T[];
  meta?: PaginationMeta;
}

// 分页元数据接口
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
```

## 工具类使用

### ListUtil 工具类

提供了统一的列表数据构建方法：

```typescript
import { ListUtil } from 'src/common/utils';

// 1. 构建分页列表结果
const result = ListUtil.buildPaginatedList(data, total, page, limit);

// 2. 构建简单列表结果（不分页）
const result = ListUtil.buildSimpleList(data);

// 3. 从 TypeORM findAndCount 结果构建分页列表
const result = ListUtil.fromFindAndCount([data, total], page, limit);

// 4. 构建分页元数据
const meta = ListUtil.buildPaginationMeta(total, page, limit);
```

## 已更新的服务方法

### 分页列表接口

1. **标签服务** - `findAll()`
2. **分类服务** - `findAll()`
3. **用户服务** - `findAllUsers()`, `getFollowers()`, `getFollowings()`
4. **文章服务** - `findAllArticles()`, `findByCategory()`, `findByTag()`, `findByAuthor()`, `searchArticles()`
5. **评论服务** - `findCommentsByArticle()`, `getReplies()`, `getUserComments()`
6. **订单服务** - `getUserOrders()`

### 简单列表接口

1. **角色服务** - `findAllRoles()`
2. **权限服务** - `findAll()`
3. **配置服务** - `findAll()`, `findByGroup()`
4. **标签服务** - `getPopularTags()`

## 返回格式示例

### 分页列表返回格式

```json
{
  "data": [
    {
      "id": 1,
      "name": "示例数据",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 10,
    "totalPages": 10
  }
}
```

### 简单列表返回格式

```json
{
  "data": [
    {
      "id": 1,
      "name": "示例数据"
    }
  ]
}
```

## 使用原则

1. **解耦设计**：工具类与具体业务逻辑分离，便于维护和扩展
2. **统一格式**：所有列表接口使用相同的返回结构
3. **类型安全**：使用 TypeScript 泛型确保类型安全
4. **向后兼容**：保持现有接口的兼容性

## 扩展说明

如需添加新的列表返回类型，可以在 `ListUtil` 工具类中添加新的静态方法，并在 `response.interface.ts` 中定义对应的接口类型。

## 注意事项

1. 所有列表接口都应该使用 `ListUtil` 工具类构建返回数据
2. 分页接口必须包含 `meta` 信息
3. 简单列表接口不需要 `meta` 信息
4. 保持返回数据结构的简洁性和一致性 