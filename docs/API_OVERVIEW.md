# API 接口概览

本文档提供所有 API 接口的快速参考。详细的接口文档请访问 Swagger UI。

## 基础信息

- **Base URL**: `http://localhost:3000`
- **API 文档**: `http://localhost:3000/api/docs`
- **认证方式**: Bearer Token (JWT)

## 接口列表

### 用户模块 (User)

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/user/register` | 用户注册 | ❌ |
| POST | `/user/login` | 用户登录 | ❌ |
| GET | `/user/profile` | 获取当前用户信息 | ✅ |
| PATCH | `/user/profile` | 更新用户信息 | ✅ |
| GET | `/user/:id` | 获取用户详情 | ❌ |
| GET | `/user` | 获取用户列表 | ✅ |
| POST | `/user/:id/follow` | 关注用户 | ✅ |
| DELETE | `/user/:id/follow` | 取消关注 | ✅ |
| GET | `/user/:id/followers` | 获取粉丝列表 | ❌ |
| GET | `/user/:id/following` | 获取关注列表 | ❌ |

### 角色模块 (Role)

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/role` | 创建角色 | ✅ |
| GET | `/role` | 获取角色列表 | ✅ |
| GET | `/role/:id` | 获取角色详情 | ✅ |
| PATCH | `/role/:id` | 更新角色 | ✅ |
| DELETE | `/role/:id` | 删除角色 | ✅ |
| POST | `/role/:id/permissions` | 分配权限 | ✅ |

### 权限模块 (Permission)

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/permission` | 创建权限 | ✅ |
| GET | `/permission` | 获取权限列表 | ✅ |
| GET | `/permission/:id` | 获取权限详情 | ✅ |
| PATCH | `/permission/:id` | 更新权限 | ✅ |
| DELETE | `/permission/:id` | 删除权限 | ✅ |

### 文章模块 (Article)

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/article` | 创建文章 | ✅ |
| GET | `/article` | 获取文章列表 | ❌ |
| GET | `/article/:id` | 获取文章详情 | ❌ |
| PATCH | `/article/:id` | 更新文章 | ✅ |
| DELETE | `/article/:id` | 删除文章 | ✅ |
| POST | `/article/:id/like` | 点赞文章 | ✅ |
| DELETE | `/article/:id/like` | 取消点赞 | ✅ |
| GET | `/article/:id/likes` | 获取点赞列表 | ❌ |
| POST | `/article/:id/view` | 增加浏览量 | ❌ |
| GET | `/article/:id/downloads` | 获取下载资源 | ✅ |

### 评论模块 (Comment)

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/comment` | 创建评论 | ✅ |
| GET | `/comment` | 获取评论列表 | ❌ |
| GET | `/comment/:id` | 获取评论详情 | ❌ |
| PATCH | `/comment/:id` | 更新评论 | ✅ |
| DELETE | `/comment/:id` | 删除评论 | ✅ |
| POST | `/comment/:id/like` | 点赞评论 | ✅ |
| GET | `/comment/:id/replies` | 获取回复列表 | ❌ |

### 分类模块 (Category)

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/category` | 创建分类 | ✅ |
| GET | `/category` | 获取分类列表 | ❌ |
| GET | `/category/:id` | 获取分类详情 | ❌ |
| PATCH | `/category/:id` | 更新分类 | ✅ |
| DELETE | `/category/:id` | 删除分类 | ✅ |
| GET | `/category/:id/articles` | 获取分类下的文章 | ❌ |
| GET | `/category/tree` | 获取分类树 | ❌ |

### 标签模块 (Tag)

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/tag` | 创建标签 | ✅ |
| GET | `/tag` | 获取标签列表 | ❌ |
| GET | `/tag/:id` | 获取标签详情 | ❌ |
| PATCH | `/tag/:id` | 更新标签 | ✅ |
| DELETE | `/tag/:id` | 删除标签 | ✅ |
| GET | `/tag/:id/articles` | 获取标签下的文章 | ❌ |

### 订单模块 (Order)

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/order` | 创建订单 | ✅ |
| GET | `/order` | 获取订单列表 | ✅ |
| GET | `/order/:id` | 获取订单详情 | ✅ |
| PATCH | `/order/:id` | 更新订单 | ✅ |
| DELETE | `/order/:id` | 取消订单 | ✅ |
| POST | `/order/:id/pay` | 支付订单 | ✅ |
| GET | `/order/my` | 获取我的订单 | ✅ |

### 支付模块 (Payment)

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/payment/alipay` | 支付宝支付 | ✅ |
| POST | `/payment/wechat` | 微信支付 | ✅ |
| POST | `/payment/balance` | 余额支付 | ✅ |
| POST | `/payment/callback/alipay` | 支付宝回调 | ❌ |
| POST | `/payment/callback/wechat` | 微信回调 | ❌ |
| GET | `/payment/:id` | 获取支付详情 | ✅ |
| GET | `/payment` | 获取支付记录 | ✅ |

### 邀请模块 (Invite)

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/invite` | 生成邀请码 | ✅ |
| GET | `/invite` | 获取邀请列表 | ✅ |
| GET | `/invite/:code` | 获取邀请详情 | ❌ |
| POST | `/invite/:code/use` | 使用邀请码 | ✅ |
| GET | `/invite/my/invitees` | 获取我的邀请人 | ✅ |
| GET | `/invite/my/earnings` | 获取邀请收益 | ✅ |
| GET | `/invite/commission` | 获取分成记录 | ✅ |

### 消息模块 (Message)

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/message` | 发送消息 | ✅ |
| GET | `/message` | 获取消息列表 | ✅ |
| GET | `/message/:id` | 获取消息详情 | ✅ |
| PATCH | `/message/:id/read` | 标记已读 | ✅ |
| DELETE | `/message/:id` | 删除消息 | ✅ |
| GET | `/message/unread/count` | 获取未读数量 | ✅ |
| POST | `/message/broadcast` | 发送广播消息 | ✅ |

### 举报模块 (Report)

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/report` | 创建举报 | ✅ |
| GET | `/report` | 获取举报列表 | ✅ |
| GET | `/report/:id` | 获取举报详情 | ✅ |
| PATCH | `/report/:id` | 更新举报状态 | ✅ |
| DELETE | `/report/:id` | 删除举报记录 | ✅ |
| GET | `/report/statistics` | 获取举报统计 | ✅ |

### 横幅模块 (Banner)

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/banner` | 创建横幅 | ✅ |
| GET | `/banner` | 获取横幅列表 | ❌ |
| GET | `/banner/:id` | 获取横幅详情 | ❌ |
| PATCH | `/banner/:id` | 更新横幅 | ✅ |
| DELETE | `/banner/:id` | 删除横幅 | ✅ |

### 系统配置模块 (Config)

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/config` | 创建配置 | ✅ |
| GET | `/config` | 获取配置列表 | ✅ |
| GET | `/config/:key` | 获取配置详情 | ❌ |
| PATCH | `/config/:key` | 更新配置 | ✅ |
| DELETE | `/config/:key` | 删除配置 | ✅ |
| GET | `/config/public` | 获取公开配置 | ❌ |

### 上传模块 (Upload)

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/upload/image` | 上传图片 | ✅ |
| POST | `/upload/file` | 上传文件 | ✅ |
| POST | `/upload/avatar` | 上传头像 | ✅ |
| DELETE | `/upload/:id` | 删除文件 | ✅ |

## 通用响应格式

### 成功响应
```json
{
  "statusCode": 200,
  "message": "操作成功",
  "data": {}
}
```

### 错误响应
```json
{
  "statusCode": 400,
  "message": "错误信息",
  "error": "Bad Request"
}
```

### 分页响应
```json
{
  "data": [],
  "total": 100,
  "page": 1,
  "limit": 10,
  "totalPages": 10
}
```

## 通用查询参数

### 分页参数
- `page`: 页码（默认 1）
- `limit`: 每页数量（默认 10）

### 排序参数
- `sortBy`: 排序字段
- `sortOrder`: 排序方式（ASC/DESC）

### 搜索参数
- `keyword`: 搜索关键词
- `status`: 状态筛选
- `startDate`: 开始日期
- `endDate`: 结束日期

## 认证说明

### 获取 Token
```bash
POST /user/login
Content-Type: application/json

{
  "username": "your_username",
  "password": "your_password"
}
```

响应：
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 604800
}
```

### 使用 Token
```bash
GET /user/profile
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 错误码说明

| 状态码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 401 | 未授权（未登录或 Token 失效） |
| 403 | 禁止访问（无权限） |
| 404 | 资源不存在 |
| 409 | 资源冲突（如用户名已存在） |
| 422 | 数据验证失败 |
| 500 | 服务器内部错误 |

## WebSocket 接口

### 连接
```javascript
const socket = io('http://localhost:3000', {
  auth: {
    token: 'your_jwt_token'
  }
});
```

### 事件列表

| 事件名 | 方向 | 说明 |
|--------|------|------|
| `message` | 接收 | 接收新消息 |
| `sendMessage` | 发送 | 发送消息 |
| `notification` | 接收 | 接收通知 |
| `online` | 接收 | 用户上线 |
| `offline` | 接收 | 用户下线 |

## 文件上传说明

### 支持的文件类型
- 图片：jpg, jpeg, png, gif, webp
- 文档：pdf, doc, docx, xls, xlsx
- 压缩包：zip, rar, 7z

### 文件大小限制
- 图片：最大 5MB
- 文档：最大 10MB
- 压缩包：最大 50MB

### 上传示例
```bash
POST /upload/image
Content-Type: multipart/form-data

file: [binary data]
```

## 速率限制

- 普通用户：100 请求/分钟
- 会员用户：500 请求/分钟
- 管理员：无限制

## 版本控制

当前 API 版本：v1

未来版本将通过 URL 前缀区分：
- v1: `/api/v1/...`
- v2: `/api/v2/...`

## 更新日志

- 2025-01-11: 初始版本，包含所有核心接口
