# 消息通知模块

## 概述

消息通知模块提供了完整的实时消息通知功能，支持 WebSocket 实时推送和 REST API 接口。

## 功能特性

### ✅ 已实现功能

- **WebSocket 实时通信**
  - JWT 认证
  - 自动房间管理
  - 心跳检测
  - 自动重连支持

- **消息类型**
  - 私信消息（private）
  - 系统消息（system）
  - 通知消息（notification）

- **消息发送**
  - 单发消息
  - 批量发送
  - 广播消息
  - 定向推送

- **消息管理**
  - 历史消息查询
  - 未读消息统计
  - 标记已读/未读
  - 批量操作
  - 消息删除

- **通知服务**
  - 基础通知服务（MessageNotificationService）
  - 增强通知服务（EnhancedNotificationService）
  - 多渠道通知（站内、邮件、短信、推送）
  - 用户通知配置

- **通知类型**
  - 系统通知
  - 评论通知
  - 点赞通知
  - 关注通知
  - 私信通知
  - 订单通知
  - 支付通知
  - 邀请通知

## 技术栈

- **NestJS** - 后端框架
- **Socket.IO** - WebSocket 库
- **TypeORM** - ORM 框架
- **JWT** - 身份认证
- **MySQL** - 数据存储

## 目录结构

```
src/modules/message/
├── dto/                                    # 数据传输对象
│   ├── create-message.dto.ts             # 创建消息 DTO
│   ├── update-message.dto.ts             # 更新消息 DTO
│   ├── query-message.dto.ts              # 查询消息 DTO
│   └── batch-message.dto.ts              # 批量操作 DTO
├── entities/                               # 实体定义
│   ├── message.entity.ts                 # 消息实体
│   └── message-read.entity.ts            # 消息已读记录实体
├── message.controller.ts                  # REST API 控制器
├── message.service.ts                     # 消息服务
├── message.gateway.ts                     # WebSocket 网关
├── message-notification.service.ts        # 基础通知服务
├── enhanced-notification.service.ts       # 增强通知服务
├── message.module.ts                      # 模块定义
└── README.md                              # 本文档
```

## 快速开始

### 1. 导入模块

在需要使用消息通知的模块中导入 `MessageModule`：

```typescript
import { Module } from '@nestjs/common';
import { MessageModule } from '../message/message.module';

@Module({
  imports: [MessageModule],
})
export class YourModule {}
```

### 2. 注入服务

```typescript
import { Injectable } from '@nestjs/common';
import { EnhancedNotificationService } from '../message/enhanced-notification.service';

@Injectable()
export class YourService {
  constructor(
    private readonly enhancedNotificationService: EnhancedNotificationService,
  ) {}
}
```

### 3. 发送通知

```typescript
// 发送系统通知
await this.enhancedNotificationService.sendSystemNotification(
  userId,
  '通知内容',
  '通知标题'
);

// 发送评论通知
await this.enhancedNotificationService.sendCommentNotification(
  userId,
  '评论者昵称',
  '文章标题',
  '评论内容',
  articleId,
  commentId
);

// 发送点赞通知
await this.enhancedNotificationService.sendLikeNotification(
  userId,
  '点赞者昵称',
  'article',
  '文章标题',
  articleId
);
```

## WebSocket 连接

### 连接地址

```
ws://localhost:3000/ws-message
```

### 认证方式

```javascript
const socket = io('ws://localhost:3000/ws-message', {
  auth: {
    token: 'your_jwt_token'
  }
});
```

### 事件列表

#### 客户端发送事件

| 事件名 | 参数 | 说明 |
|--------|------|------|
| `sendMessage` | `{ content, toUserId?, type? }` | 发送消息 |
| `getHistory` | `{ page?, limit? }` | 获取历史消息 |
| `getUnreadCount` | 无 | 获取未读数量 |
| `markAllAsRead` | `{ type?, isBroadcast? }` | 标记所有已读 |
| `readMessage` | `{ messageId }` | 标记单条已读 |
| `ping` | 无 | 心跳检测 |

#### 服务端推送事件

| 事件名 | 数据 | 说明 |
|--------|------|------|
| `connected` | `{ message, user }` | 连接成功 |
| `error` | `{ message, code }` | 错误信息 |
| `newMessage` | `Message` | 新消息通知 |
| `history` | `PaginatedList<Message>` | 历史消息 |
| `unreadCount` | `{ personal, broadcast, total }` | 未读数量 |
| `pong` | `{ message, userId, timestamp }` | 心跳响应 |

## REST API

### 创建消息

```http
POST /api/v1/message
Authorization: Bearer {token}

{
  "content": "消息内容",
  "receiverId": 2,
  "type": "private"
}
```

### 获取消息列表

```http
GET /api/v1/message?page=1&limit=20
Authorization: Bearer {token}
```

### 标记消息为已读

```http
POST /api/v1/message/:id/read
Authorization: Bearer {token}
```

### 获取未读数量

```http
GET /api/v1/message/unread/count
Authorization: Bearer {token}
```

## 数据库表结构

### message 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int | 主键 |
| senderId | int | 发送者ID（系统消息为 null） |
| receiverId | int | 接收者ID |
| content | text | 消息内容 |
| type | enum | 消息类型（private/system/notification） |
| isRead | boolean | 是否已读 |
| isBroadcast | boolean | 是否广播消息 |
| title | varchar | 消息标题 |
| metadata | json | 元数据 |
| createdAt | datetime | 创建时间 |
| updatedAt | datetime | 更新时间 |

### message_read 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int | 主键 |
| userId | int | 用户ID |
| messageId | int | 消息ID |
| createdAt | datetime | 创建时间 |

## 服务说明

### MessageService

基础消息服务，提供消息的 CRUD 操作。

**主要方法：**
- `create()` - 创建消息
- `findAll()` - 查询消息列表
- `findOne()` - 查询单条消息
- `update()` - 更新消息
- `remove()` - 删除消息
- `markAsRead()` - 标记已读
- `markAllAsRead()` - 标记所有已读
- `getUnreadCount()` - 获取未读数量
- `batchOperation()` - 批量操作

### MessageGateway

WebSocket 网关，处理实时通信。

**主要功能：**
- JWT 认证
- 连接管理
- 房间管理
- 消息推送
- 事件处理

### MessageNotificationService

基础通知服务，提供常用的通知发送方法。

**主要方法：**
- `sendSystemNotification()` - 发送系统通知
- `sendWelcomeMessage()` - 发送欢迎消息
- `sendOrderStatusNotification()` - 发送订单通知
- `sendPaymentSuccessNotification()` - 发送支付通知
- `sendBalanceChangeNotification()` - 发送余额变动通知
- `sendArticleNotification()` - 发送文章通知

### EnhancedNotificationService

增强通知服务，支持多渠道通知和用户配置。

**主要方法：**
- `sendNotification()` - 根据用户配置发送通知
- `sendCommentNotification()` - 发送评论通知
- `sendLikeNotification()` - 发送点赞通知
- `sendFollowNotification()` - 发送关注通知
- `sendMessageNotification()` - 发送私信通知
- `sendOrderNotification()` - 发送订单通知
- `sendPaymentNotification()` - 发送支付通知
- `sendInviteNotification()` - 发送邀请通知

## 用户通知配置

用户可以在 `user_config` 表中配置通知偏好：

```typescript
{
  enableSystemNotification: true,      // 系统通知
  enableCommentNotification: true,     // 评论通知
  enableLikeNotification: true,        // 点赞通知
  enableFollowNotification: true,      // 关注通知
  enableMessageNotification: true,     // 私信通知
  enableOrderNotification: true,       // 订单通知
  enablePaymentNotification: true,     // 支付通知
  enableInviteNotification: true,      // 邀请通知
  enableEmailNotification: false,      // 邮件通知
  enableSmsNotification: false,        // 短信通知
  enablePushNotification: true         // 推送通知
}
```

## 消息元数据

消息的 `metadata` 字段可以包含额外信息：

```typescript
{
  notificationType: 'comment',  // 通知类型
  articleId: 123,               // 文章ID
  commentId: 456,               // 评论ID
  targetId: 789,                // 目标ID
  targetType: 'article',        // 目标类型
  // ... 其他自定义字段
}
```

## 测试

### 使用测试页面

访问测试页面：
```
http://localhost:3000/static/public/websocket-test.html
```

### 使用 Postman

1. 创建 WebSocket 请求
2. URL: `ws://localhost:3000/ws-message`
3. 添加认证 Token
4. 发送测试消息

## 最佳实践

### 1. 使用事件驱动

```typescript
// 发送事件
this.eventEmitter.emit('article.published', new ArticlePublishedEvent(...));

// 监听事件
@OnEvent('article.published')
async handleArticlePublished(event: ArticlePublishedEvent) {
  await this.enhancedNotificationService.sendSystemNotification(...);
}
```

### 2. 异步处理

使用队列处理通知，避免阻塞主业务：

```typescript
await this.notificationQueue.add('send', notificationData);
```

### 3. 错误处理

添加适当的错误处理：

```typescript
try {
  await this.enhancedNotificationService.sendSystemNotification(...);
} catch (error) {
  console.error('发送通知失败:', error);
}
```

### 4. 通知去重

避免短时间内发送重复通知。

## 相关文档

- [WebSocket 使用指南](../../../docs/WEBSOCKET_GUIDE.md)
- [WebSocket 集成指南](../../../docs/WEBSOCKET_INTEGRATION.md)
- [项目概览](../../../docs/PROJECT_OVERVIEW.md)
- [数据库设计](../../../docs/DATABASE.md)

## 常见问题

### Q: 如何发送广播消息？

A: 设置 `isBroadcast: true` 或不指定 `receiverId`：

```typescript
await this.messageNotificationService.sendSystemNotification(
  '系统维护通知',
  '系统将于今晚维护',
  undefined, // 不指定接收者，表示广播
  { type: 'maintenance' }
);
```

### Q: 如何批量发送消息？

A: 传入接收者ID数组：

```typescript
await this.messageNotificationService.sendSystemNotification(
  '活动通知',
  '新活动开始了',
  [1, 2, 3, 4, 5], // 接收者ID列表
  { type: 'activity' }
);
```

### Q: 如何自定义通知内容？

A: 使用 `metadata` 字段存储额外信息：

```typescript
await this.enhancedNotificationService.sendSystemNotification(
  userId,
  '自定义通知内容',
  '自定义标题',
  {
    customField1: 'value1',
    customField2: 'value2',
    // ... 其他自定义字段
  }
);
```

### Q: 如何处理离线消息？

A: 系统会自动保存所有消息到数据库。用户上线后，通过 `getHistory` 事件获取历史消息。

## 更新日志

### v1.0.0 (2024-01-14)

- ✅ 实现 WebSocket 实时通信
- ✅ 实现 JWT 认证
- ✅ 实现消息 CRUD
- ✅ 实现已读/未读管理
- ✅ 实现基础通知服务
- ✅ 实现增强通知服务
- ✅ 实现用户通知配置
- ✅ 实现多种通知类型
- ✅ 添加测试页面
- ✅ 完善文档

## 技术支持

如有问题，请联系开发团队或提交 Issue。
