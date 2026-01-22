# 文章收藏功能

## 功能概述

为文章模块添加了独立的收藏功能，用户可以直接收藏文章。这个功能与"收藏夹（合集）"是分开的：
- **收藏**：用户收藏喜欢的文章，简单的收藏关系
- **收藏夹（合集）**：作者创建的文章集合，用于组织和展示系列文章

## 数据库设计

### ArticleFavorite 实体
```typescript
{
  id: number;              // 主键
  userId: number;          // 用户ID
  articleId: number;       // 文章ID
  createdAt: Date;         // 收藏时间
}
```

### Article 实体新增字段
- `favoriteCount`: 文章被收藏的总次数

## 新增接口

### 1. 收藏文章
- **路径**: `POST /article/:id/favorite`
- **权限**: 需要登录
- **描述**: 收藏文章
- **响应**:
  ```json
  {
    "success": true,
    "message": "response.success.articleFavorited",
    "data": {
      "favoriteId": 1,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  }
  ```

### 2. 取消收藏文章
- **路径**: `DELETE /article/:id/favorite`
- **权限**: 需要登录
- **描述**: 取消收藏文章
- **响应**:
  ```json
  {
    "success": true,
    "message": "response.success.articleUnfavorited"
  }
  ```

### 3. 检查收藏状态
- **路径**: `GET /article/:id/favorite/status`
- **权限**: 需要登录
- **描述**: 检查文章是否已被当前用户收藏
- **响应**:
  ```json
  {
    "isFavorited": true,
    "favoritedAt": "2024-01-01T00:00:00.000Z"
  }
  ```

### 4. 获取收藏的文章列表
- **路径**: `GET /article/favorited/list`
- **权限**: 需要登录
- **查询参数**: 
  - `page`: 页码（默认 1）
  - `limit`: 每页数量（默认 10）
- **描述**: 获取当前用户收藏的所有文章
- **响应**: 分页的文章列表，每篇文章包含 `favoritedAt` 字段表示收藏时间

## 实现细节

### 数据存储
- 使用独立的 `ArticleFavorite` 表存储收藏关系
- 每个用户对每篇文章只能收藏一次（唯一索引约束）
- 文章表增加 `favoriteCount` 字段记录收藏总数

### 自动计数
- 收藏时自动增加文章的 `favoriteCount`
- 取消收藏时自动减少文章的 `favoriteCount`

### 事件触发
收藏文章时会触发两个事件：

#### 1. article.favorited
奖励**收藏者**（执行收藏动作的用户）

```typescript
{
  userId: number,        // 收藏者ID
  articleId: number,     // 文章ID
  articleTitle: string   // 文章标题
}
```

用途：
- 积分系统：收藏者获得积分
- 装饰品系统：更新收藏活动进度
- 统计分析

#### 2. article.receivedFavorite
奖励**文章作者**（文章被收藏）

```typescript
{
  authorId: number,      // 文章作者ID
  articleId: number,     // 文章ID
  favoriterId: number    // 收藏者ID
}
```

用途：
- 积分系统：文章作者获得积分
- 等级系统：文章作者获得经验
- 成就系统：更新被收藏相关成就
- 通知系统：通知作者文章被收藏

**注意**：如果用户收藏自己的文章，只触发 `article.favorited` 事件，不触发 `article.receivedFavorite` 事件。

### 级联删除
- 删除用户时，自动删除该用户的所有收藏记录
- 删除文章时，自动删除该文章的所有收藏记录

## 与收藏夹（合集）的区别

| 功能 | 收藏 | 收藏夹（合集） |
|------|------|---------------|
| 用途 | 用户收藏喜欢的文章 | 作者创建文章集合 |
| 创建者 | 任何用户 | 通常是作者 |
| 组织方式 | 简单列表 | 可排序、可分类 |
| 公开性 | 私有 | 可公开可私有 |
| 数据表 | `article_favorite` | `favorite` + `favorite_item` |
| 接口前缀 | `/article/:id/favorite` | `/favorite` |

## 使用示例

### 前端集成示例

```typescript
// 收藏文章
async function favoriteArticle(articleId: number) {
  try {
    const response = await fetch(`/article/${articleId}/favorite`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await response.json();
    console.log('收藏成功:', data);
  } catch (error) {
    console.error('收藏失败:', error);
  }
}

// 检查收藏状态
async function checkFavoriteStatus(articleId: number) {
  const response = await fetch(`/article/${articleId}/favorite/status`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  const data = await response.json();
  return data.isFavorited;
}

// 取消收藏
async function unfavoriteArticle(articleId: number) {
  await fetch(`/article/${articleId}/favorite`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
}

// 获取收藏列表
async function getFavoritedArticles(page = 1, limit = 10) {
  const response = await fetch(
    `/article/favorited/list?page=${page}&limit=${limit}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );
  return await response.json();
}
```

## 错误处理

- `404`: 文章不存在
- `400`: 文章已收藏（重复收藏）
- `401`: 未登录
- `404`: 收藏记录不存在（取消收藏时）

## 国际化键值

需要在国际化文件中添加以下键值：

```json
{
  "response.success.articleFavorited": "收藏成功",
  "response.success.articleUnfavorited": "取消收藏成功",
  "response.error.alreadyFavorited": "文章已收藏",
  "response.error.favoriteNotFound": "收藏记录不存在"
}
```

## 数据库迁移

需要执行以下操作：

1. 创建 `article_favorite` 表
2. 在 `article` 表添加 `favoriteCount` 字段（默认值为 0）
3. 创建唯一索引：`userId` + `articleId`

```sql
-- 创建收藏表
CREATE TABLE `article_favorite` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL COMMENT '用户ID',
  `articleId` int NOT NULL COMMENT '文章ID',
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '收藏时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_userId_articleId` (`userId`, `articleId`),
  KEY `FK_article_favorite_user` (`userId`),
  KEY `FK_article_favorite_article` (`articleId`),
  CONSTRAINT `FK_article_favorite_user` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_article_favorite_article` FOREIGN KEY (`articleId`) REFERENCES `article` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='文章收藏表';

-- 添加收藏数字段
ALTER TABLE `article` ADD COLUMN `favoriteCount` int NOT NULL DEFAULT 0 COMMENT '收藏数' AFTER `likes`;
```
