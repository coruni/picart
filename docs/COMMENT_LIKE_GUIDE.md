# 评论点赞功能指南

## 功能概述

评论点赞功能允许用户对评论进行点赞和取消点赞操作，系统会记录点赞状态并发送通知。

## 数据库设计

### comment_like 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int | 主键 |
| commentId | int | 评论ID |
| userId | int | 用户ID |
| createdAt | datetime | 创建时间 |

**索引：**
- 唯一索引：`(commentId, userId)` - 确保每个用户对每条评论只能点赞一次

**外键：**
- `commentId` → `comment.id` (CASCADE DELETE)
- `userId` → `user.id` (CASCADE DELETE)

## API 接口

### 1. 点赞/取消点赞评论

**接口：** `POST /comment/:id/like`

**权限：** 需要登录

**参数：**
- `id` (路径参数): 评论ID

**响应：**

点赞成功：
```json
{
  "success": true,
  "message": "response.success.commentLike",
  "data": {
    "isLiked": true
  }
}
```

取消点赞成功：
```json
{
  "success": true,
  "message": "response.success.commentUnlike",
  "data": {
    "isLiked": false
  }
}
```

### 2. 获取文章评论列表（包含点赞状态）

**接口：** `GET /comment/article/:id`

**权限：** 公开（登录用户可查看点赞状态）

**参数：**
- `id` (路径参数): 文章ID
- `page` (查询参数): 页码，默认 1
- `limit` (查询参数): 每页数量，默认 10

**响应：**
```json
{
  "data": [
    {
      "id": 1,
      "content": "评论内容",
      "images": ["url1", "url2"],
      "likes": 10,
      "isLiked": true,
      "author": {
        "id": 1,
        "username": "user1",
        "nickname": "用户1",
        "avatar": "avatar.jpg",
        "isMember": true
      },
      "replies": [
        {
          "id": 2,
          "content": "回复内容",
          "isLiked": false,
          "likes": 5
        }
      ]
    }
  ],
  "total": 100,
  "page": 1,
  "limit": 10
}
```

### 3. 获取评论详情（包含点赞状态）

**接口：** `GET /comment/:id`

**权限：** 公开（登录用户可查看点赞状态）

**参数：**
- `id` (路径参数): 评论ID
- `page` (查询参数): 回复列表页码
- `limit` (查询参数): 回复列表每页数量

**响应：** 返回该评论的所有回复，包含点赞状态

## 功能特性

### 1. 点赞/取消点赞

- 用户点击点赞按钮时：
  - 如果未点赞：添加点赞记录，增加点赞数
  - 如果已点赞：删除点赞记录，减少点赞数
- 点赞数实时更新到 `comment.likes` 字段
- 防止重复点赞（数据库唯一索引）

### 2. 点赞状态显示

- 评论列表中显示 `isLiked` 字段
- 登录用户可以看到自己的点赞状态
- 未登录用户 `isLiked` 为 `false`

### 3. 通知功能

- 用户点赞评论时，评论作者会收到通知
- 排除自己点赞自己的评论
- 通知内容包括：
  - 点赞用户昵称
  - 评论内容（超过50字截断）
  - 评论ID和文章ID

### 4. 事件触发

- 点赞时触发 `comment.liked` 事件
- 可用于装饰品活动进度等功能
- 事件数据：
  ```typescript
  {
    userId: number,
    commentId: number,
    articleId: number
  }
  ```

## 实现细节

### Service 层

**CommentService 新增方法：**

```typescript
// 点赞/取消点赞
async like(id: number, user: User)

// 查询评论列表（带点赞状态）
async findCommentsByArticle(articleId: number, pagination: PaginationDto, currentUser?: User)

// 查询评论详情（带点赞状态）
async findCommentDetail(id: number, pagination: PaginationDto, currentUser?: User)
```

### 性能优化

1. **批量查询点赞状态**
   - 一次性查询所有评论的点赞状态
   - 使用 `In` 操作符批量查询
   - 使用 `Set` 存储点赞ID，快速判断

2. **索引优化**
   - `(commentId, userId)` 唯一索引
   - 快速查询用户是否点赞某评论

3. **级联删除**
   - 评论删除时自动删除点赞记录
   - 用户删除时自动删除点赞记录

## 数据库迁移

运行迁移创建 `comment_like` 表：

```bash
npm run migration:run
```

迁移文件：`src/migrations/20260114101220-CreateCommentLikeTable.ts`

## 前端集成示例

### 点赞按钮

```typescript
const handleLike = async (commentId: number) => {
  try {
    const response = await api.post(`/comment/${commentId}/like`);
    if (response.data.success) {
      // 更新本地状态
      setIsLiked(response.data.data.isLiked);
      // 更新点赞数
      setLikes(prev => response.data.data.isLiked ? prev + 1 : prev - 1);
    }
  } catch (error) {
    console.error('点赞失败', error);
  }
};
```

### 显示点赞状态

```tsx
<button 
  onClick={() => handleLike(comment.id)}
  className={comment.isLiked ? 'liked' : ''}
>
  <LikeIcon />
  <span>{comment.likes}</span>
</button>
```

## 注意事项

1. **权限控制**
   - 点赞需要登录
   - 查看点赞状态不需要登录（但只有登录用户能看到自己的点赞状态）

2. **并发控制**
   - 数据库唯一索引防止重复点赞
   - 使用事务确保数据一致性

3. **通知发送**
   - 通知发送失败不影响点赞操作
   - 异步发送，不阻塞主流程

4. **事件触发**
   - 事件触发失败不影响点赞操作
   - 使用 try-catch 捕获异常

## 测试建议

1. **功能测试**
   - 测试点赞和取消点赞
   - 测试重复点赞（应该被阻止）
   - 测试未登录用户点赞（应该返回401）

2. **性能测试**
   - 测试大量评论的点赞状态查询
   - 测试并发点赞

3. **边界测试**
   - 测试不存在的评论ID
   - 测试已删除的评论
   - 测试点赞数为0时取消点赞

## 相关文件

- Entity: `src/modules/comment/entities/comment-like.entity.ts`
- Service: `src/modules/comment/comment.service.ts`
- Controller: `src/modules/comment/comment.controller.ts`
- Module: `src/modules/comment/comment.module.ts`
- Migration: `src/migrations/20260114101220-CreateCommentLikeTable.ts`
