# 举报模块

## 功能概述

举报模块允许用户举报不当内容，包括用户、文章和评论。管理员可以查看、处理和统计举报信息。

## 主要功能

### 1. 举报类型
- **用户举报**: 举报违规用户
- **文章举报**: 举报不当文章内容
- **评论举报**: 举报不当评论

### 2. 举报分类
- `SPAM`: 垃圾信息
- `ABUSE`: 辱骂攻击
- `INAPPROPRIATE`: 不当内容
- `COPYRIGHT`: 版权侵犯
- `OTHER`: 其他原因

### 3. 处理状态
- `PENDING`: 待处理
- `PROCESSING`: 处理中
- `RESOLVED`: 已解决
- `REJECTED`: 已驳回

### 4. 处理动作
- `DELETE_CONTENT`: 删除内容（删除被举报的文章或评论）
- `BAN_USER`: 封禁用户（封禁违规用户账号）
- `WARNING`: 警告（仅警告，不做实质处理）
- `NONE`: 无需处理（举报不成立）

## API 接口

### 创建举报
```
POST /report
```

请求体示例：
```json
{
  "type": "ARTICLE",
  "reason": "包含不当内容",
  "category": "INAPPROPRIATE",
  "description": "文章中包含违规图片",
  "reportedArticleId": 123
}
```

### 获取举报列表
```
GET /report?page=1&limit=10&type=ARTICLE&status=PENDING
```

查询参数：
- `page`: 页码（默认1）
- `limit`: 每页数量（默认10）
- `type`: 举报类型（可选）
- `status`: 处理状态（可选）
- `category`: 举报分类（可选）
- `reporterId`: 举报人ID（可选）

### 获取举报详情
```
GET /report/:id
```

### 更新举报状态
```
PATCH /report/:id
```

请求体示例：
```json
{
  "status": "RESOLVED",
  "action": "DELETE_CONTENT",
  "result": "已删除违规内容"
}
```

处理动作说明：
- `DELETE_CONTENT`: 自动删除被举报的文章或评论
- `BAN_USER`: 自动封禁违规用户（将用户状态设为 BANNED）
- `WARNING`: 仅记录警告，不执行实质操作
- `NONE`: 举报不成立，不执行任何操作

### 删除举报记录
```
DELETE /report/:id
```

### 获取举报统计
```
GET /report/statistics
```

返回示例：
```json
{
  "total": 100,
  "byStatus": {
    "pending": 20,
    "processing": 10,
    "resolved": 60,
    "rejected": 10
  },
  "byType": [
    { "type": "ARTICLE", "count": 50 },
    { "type": "COMMENT", "count": 30 },
    { "type": "USER", "count": 20 }
  ],
  "byCategory": [
    { "category": "SPAM", "count": 40 },
    { "category": "INAPPROPRIATE", "count": 35 },
    { "category": "ABUSE", "count": 25 }
  ]
}
```

## 数据库设计

### Report 实体字段

| 字段名 | 类型 | 长度 | 默认值 | 可空 | 说明 |
|--------|------|------|--------|------|------|
| id | int | - | AUTO | N | 举报ID（主键） |
| type | enum | - | - | N | 举报类型：USER-用户，ARTICLE-文章，COMMENT-评论 |
| reason | text | - | - | N | 举报原因 |
| category | enum | - | - | N | 举报分类：SPAM-垃圾信息，ABUSE-辱骂攻击，INAPPROPRIATE-不当内容，COPYRIGHT-版权侵犯，OTHER-其他 |
| description | text | - | NULL | Y | 详细描述 |
| status | enum | - | PENDING | N | 处理状态：PENDING-待处理，PROCESSING-处理中，RESOLVED-已解决，REJECTED-已驳回 |
| result | text | - | NULL | Y | 处理结果 |
| action | enum | - | NULL | Y | 处理动作：DELETE_CONTENT-删除内容，BAN_USER-封禁用户，WARNING-警告，NONE-无需处理 |
| reporterId | int | - | NULL | Y | 举报人ID（外键） |
| reportedUserId | int | - | NULL | Y | 被举报用户ID（外键） |
| reportedArticleId | int | - | NULL | Y | 被举报文章ID（外键） |
| reportedCommentId | int | - | NULL | Y | 被举报评论ID（外键） |
| handlerId | int | - | NULL | Y | 处理人ID（外键） |
| handledAt | datetime | - | NULL | Y | 处理时间 |
| createdAt | datetime | - | NOW | N | 创建时间 |
| updatedAt | datetime | - | NOW | N | 更新时间 |

**关联关系：**
- 多对一：reporter (举报人-用户)
- 多对一：reportedUser (被举报用户)
- 多对一：reportedArticle (被举报文章)
- 多对一：reportedComment (被举报评论)
- 多对一：handler (处理人-用户)

## 特性

1. **防重复举报**: 同一用户对同一内容的待处理举报只能存在一条
2. **目标验证**: 创建举报时会验证被举报对象是否存在
3. **关联查询**: 查询时自动关联举报人、被举报对象、处理人信息
4. **统计功能**: 提供按状态、类型、分类的统计数据
5. **直接使用实体**: 不依赖其他模块的服务，直接使用 User、Article、Comment 实体表
6. **自动化处理**: 支持处理动作自动执行
   - 删除内容：自动删除被举报的文章或评论
   - 封禁用户：自动将违规用户状态设为 BANNED
   - 智能识别：根据举报类型自动识别要封禁的用户（文章作者或评论作者）

## 使用说明

1. 模块已注册到 `AppModule`
2. 使用 TypeORM 直接操作数据库表
3. 需要配合认证守卫获取当前用户信息（控制器中的 `req.user.id`）
4. 建议添加权限控制，限制管理员才能查看所有举报和处理举报
