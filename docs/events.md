# 系统事件文档

本文档列出了系统中所有的事件及其监听器，方便开发者了解事件驱动架构。

## 目录

- [WebSocket 事件](#websocket-事件)
- [文章相关事件](#文章相关事件)
- [评论相关事件](#评论相关事件)
- [用户相关事件](#用户相关事件)
- [成就相关事件](#成就相关事件)
- [装饰品相关事件](#装饰品相关事件)
- [系统相关事件](#系统相关事件)
- [事件监听器汇总](#事件监听器汇总)

---

## WebSocket 事件

消息模块使用 Socket.IO，命名空间为：

```txt
/ws-message
```

认证方式：

- `handshake.auth.token`
- `Authorization: Bearer <token>`
- `query.token`

连接成功后，服务端会自动让当前用户加入自己的房间：

```txt
room = <userId>
```

### 客户端发送事件

| 事件                      | 说明                                                                               | 用法                                                                                                 |
| ------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `join`                    | 手动加入当前用户自己的房间。通常不需要主动调用，连接成功后服务端会自动加入。       | `socket.emit("join")`                                                                                |
| `leave`                   | 手动离开当前用户自己的房间。                                                       | `socket.emit("leave")`                                                                               |
| `sendMessage`             | 发送消息，支持私信、通知、广播。私信推荐使用 `type: "private"` 和 `toUserId`。     | `socket.emit("sendMessage", { toUserId: 2, type: "private", messageKind: "text", content: "你好" })` |
| `getHistory`              | 获取当前用户的通知消息列表。                                                       | `socket.emit("getHistory", { page: 1, limit: 20 })`                                                  |
| `getPrivateConversations` | 获取私信会话列表，当前使用游标分页。                                               | `socket.emit("getPrivateConversations", { cursor, limit: 20 })`                                      |
| `getPrivateHistory`       | 获取与指定用户的私信历史，当前使用游标分页。                                       | `socket.emit("getPrivateHistory", { userId: 2, cursor, limit: 20 })`                                 |
| `readPrivateMessages`     | 批量标记私信已读。                                                                 | `socket.emit("readPrivateMessages", { messageIds: [101, 102] })`                                     |
| `recallPrivateMessage`    | 撤回自己发送的私信。                                                               | `socket.emit("recallPrivateMessage", { messageId: 101, reason: "发错了" })`                          |
| `getUnreadCount`          | 获取未读消息统计。                                                                 | `socket.emit("getUnreadCount")`                                                                      |
| `markAllAsRead`           | 批量标记消息已读。支持通知消息、广播消息和私信；私信请传 `type: "private"`。       | `socket.emit("markAllAsRead", { type: "private" })`                                                  |
| `batchOperation`          | 批量操作通知消息，支持已读和删除。                                                 | `socket.emit("batchOperation", { messageIds: [1, 2], action: "read" })`                              |
| `readMessage`             | 标记单条通知消息已读。                                                             | `socket.emit("readMessage", { messageId: 1 })`                                                       |
| `subscribeUserStatus`     | 订阅指定用户的在线状态变化。订阅成功后会先返回一次当前状态，后续状态变化继续推送。 | `socket.emit("subscribeUserStatus", { userId: 2 })`                                                  |
| `unsubscribeUserStatus`   | 取消订阅指定用户的在线状态变化。                                                   | `socket.emit("unsubscribeUserStatus", { userId: 2 })`                                                |
| `getUserStatus`           | 获取指定用户当前在线状态，不建立持续订阅。                                         | `socket.emit("getUserStatus", { userId: 2 })`                                                        |
| `getProfile`              | 获取当前 WebSocket 登录用户的简要信息。                                            | `socket.emit("getProfile")`                                                                          |
| `ping`                    | 心跳检测。                                                                         | `socket.emit("ping")`                                                                                |

### 服务端推送事件

| 事件                         | 说明                                                                                                                   | 用法                                                                                                            |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `connected`                  | WebSocket 连接成功且 JWT 验证通过后返回。                                                                              | `socket.on("connected", (payload) => { console.log(payload.user) })`                                            |
| `error`                      | 鉴权失败或业务处理失败时返回。常见错误码包括 `AUTH_FAILED`、`MESSAGE_SEND_FAILED`、`PRIVATE_HISTORY_FETCH_FAILED` 等。 | `socket.on("error", (payload) => { console.error(payload.message, payload.code) })`                             |
| `joined`                     | 调用 `join` 后返回加入房间结果。                                                                                       | `socket.on("joined", (payload) => { console.log(payload.room) })`                                               |
| `leaved`                     | 调用 `leave` 后返回离开房间结果。                                                                                      | `socket.on("leaved", (payload) => { console.log(payload.room) })`                                               |
| `newMessage`                 | 通用新消息事件。通知消息和私信都会触发，适合全局角标、消息中心更新。                                                   | `socket.on("newMessage", (message) => { console.log(message) })`                                                |
| `privateMessage`             | 私信实时下发事件。发送方和接收方都会收到，适合聊天窗口增量更新。                                                       | `socket.on("privateMessage", (message) => { appendMessage(message) })`                                          |
| `history`                    | `getHistory` 的返回结果。                                                                                              | `socket.on("history", (payload) => { setList(payload.data) })`                                                  |
| `privateConversations`       | `getPrivateConversations` 的返回结果。                                                                                 | `socket.on("privateConversations", (payload) => { setConversations(payload.data) })`                            |
| `privateHistory`             | `getPrivateHistory` 的返回结果。                                                                                       | `socket.on("privateHistory", (payload) => { setMessages(payload.data) })`                                       |
| `privateConversationUpdated` | 私信会话摘要变更时推送，常见于发消息、已读、撤回之后。适合直接更新会话列表中的最新消息、未读数和排序。                 | `socket.on("privateConversationUpdated", (conversation) => { updateConversation(conversation) })`               |
| `privateMessagesRead`        | `readPrivateMessages` 对当前调用方返回的批量已读结果。                                                                 | `socket.on("privateMessagesRead", (payload) => { console.log(payload.messageIds) })`                            |
| `privateMessagesReadReceipt` | 私信发送方收到的已读回执。                                                                                             | `socket.on("privateMessagesReadReceipt", (receipt) => { markRead(receipt.messageId, receipt.readAt) })`         |
| `privateMessageRecalled`     | 私信撤回后推送给会话双方。前端应更新消息状态，不应直接删掉该消息。                                                     | `socket.on("privateMessageRecalled", (message) => { updateMessage(message) })`                                  |
| `unreadCount`                | `getUnreadCount` 的返回结果，包含 `personal`、`notification`、`private`、`broadcast`、`total`。                        | `socket.on("unreadCount", (payload) => { setUnread(payload.total) })`                                           |
| `allMarkedAsRead`            | `markAllAsRead` 的返回结果。                                                                                           | `socket.on("allMarkedAsRead", (payload) => { console.log(payload) })`                                           |
| `batchOperationResult`       | `batchOperation` 的返回结果。                                                                                          | `socket.on("batchOperationResult", (payload) => { console.log(payload) })`                                      |
| `read`                       | `readMessage` 的返回结果。                                                                                             | `socket.on("read", ({ messageId }) => { markNotificationRead(messageId) })`                                     |
| `userStatus`                 | `getUserStatus` 或 `subscribeUserStatus` 的返回结果，表示指定用户当前在线状态。                                        | `socket.on("userStatus", (payload) => { setUserStatus(payload.userId, payload.isOnline, payload.lastSeenAt) })` |
| `userStatusChanged`          | 已订阅用户的在线状态发生变化时推送。连接建立后的首次上线和最后一个连接断开后的离线都会触发。                           | `socket.on("userStatusChanged", (payload) => { updateUserPresence(payload) })`                                  |
| `profile`                    | `getProfile` 的返回结果。                                                                                              | `socket.on("profile", (payload) => { setProfile(payload) })`                                                    |
| `pong`                       | `ping` 的返回结果。                                                                                                    | `socket.on("pong", (payload) => { console.log(payload.timestamp) })`                                            |

### `sendMessage` 私信 payload 格式

使用 WebSocket 发送私信时，事件名固定为：

```txt
sendMessage
```

私信场景支持的 payload 字段如下：

| 字段          | 类型                                    | 必填           | 说明                                              |
| ------------- | --------------------------------------- | -------------- | ------------------------------------------------- |
| `toUserId`    | `number`                                | 是             | 接收方用户 ID。                                   |
| `type`        | `"private"`                             | 否             | 私信类型，默认就是 `private`，建议显式传入。      |
| `messageKind` | `"text" \| "image" \| "file" \| "card"` | 否             | 消息类型，默认 `text`。                           |
| `content`     | `string`                                | 文本消息必填   | 文本内容，最大 5000 字符。`text` 类型下不能为空。 |
| `payload`     | `object`                                | 非文本消息必填 | 结构化负载，`image`、`file`、`card` 类型必须传。  |

不同 `messageKind` 的真实校验规则如下：

- `text`：必须传有效的 `content`
- `image`：`payload.url` 或 `payload.urls` 必填
- `file`：`payload.url` 和 `payload.name` 必填
- `card`：`payload.title` 和 `payload.description` 必填

图片消息兼容两种格式：

- 单图：`payload.url`
- 多图：`payload.urls`

服务端会把图片消息统一归一化为：

```ts
payload: {
  url: "第一张图片地址",
  urls: ["第一张图片地址", "第二张图片地址"]
}
```

所以旧前端继续读 `payload.url` 也不会失效，新前端可以直接用 `payload.urls` 渲染多图。

文本私信示例：

```ts
socket.emit("sendMessage", {
  toUserId: 2,
  type: "private",
  messageKind: "text",
  content: "你好",
});
```

图片私信示例：

```ts
socket.emit("sendMessage", {
  toUserId: 2,
  type: "private",
  messageKind: "image",
  payload: {
    url: "https://example.com/demo.png",
  },
});
```

多图私信示例：

```ts
socket.emit("sendMessage", {
  toUserId: 2,
  type: "private",
  messageKind: "image",
  payload: {
    urls: [
      "https://example.com/1.png",
      "https://example.com/2.png",
      "https://example.com/3.png",
    ],
  },
});
```

文件私信示例：

```ts
socket.emit("sendMessage", {
  toUserId: 2,
  type: "private",
  messageKind: "file",
  payload: {
    url: "https://example.com/demo.pdf",
    name: "demo.pdf",
  },
});
```

卡片私信示例：

```ts
socket.emit("sendMessage", {
  toUserId: 2,
  type: "private",
  messageKind: "card",
  payload: {
    title: "活动卡片",
    description: "今晚 8 点开始",
  },
});
```

### 推荐监听集合

建议前端至少监听这些事件：

- `connected`
- `error`
- `privateMessage`
- `privateConversationUpdated`
- `privateMessagesReadReceipt`
- `privateMessageRecalled`
- `userStatusChanged`
- `unreadCount`

### 接入建议

- REST 负责首屏拉取、后台管理操作、兜底重试。
- WebSocket 负责实时推送、会话排序更新、已读回执、撤回同步。
- 聊天页优先监听 `privateMessage`，消息中心或全局角标监听 `newMessage`。
- 用户在线状态建议进入会话页后调用一次 `subscribeUserStatus`，离开页面时调用 `unsubscribeUserStatus`。
- 调用 `markAllAsRead` 成功后，服务端会额外推送一次最新的 `unreadCount`，前端可以直接刷新角标。

---

## 文章相关事件

### article.created

**触发时机：** 用户发布文章（状态为 PUBLISHED）

**触发位置：** `src/modules/article/article.service.ts`

**Payload：**

```typescript
{
  userId: number; // 作者ID
  articleId: number; // 文章ID
}
```

**监听器：**

- ✅ **积分系统** (`PointsEventService`) - 发布文章获得积分
- ✅ **等级系统** (`LevelEventService`) - 发布文章获得经验
- ✅ **成就系统** (`AchievementEventService`) - 更新文章发布相关成就进度

**业务逻辑：**

- 用户获得发布文章积分
- 用户获得发布文章经验
- 更新成就进度（第一篇文章、10篇文章、50篇文章、100篇文章）

---

### article.liked

**触发时机：** 用户点赞文章（reaction 类型为 "like"）

**触发位置：** `src/modules/article/article.service.ts`

**Payload：**

```typescript
{
  userId: number;      // 点赞用户ID
  articleId: number;   // 文章ID
  userName?: string;   // 点赞用户名称
}
```

**监听器：**

- ✅ **积分系统** (`PointsEventService`) - 点赞文章获得积分
- ✅ **通知系统** (`NotificationEventService`) - 发送点赞通知给文章作者
- ✅ **装饰品系统** (`DecorationEventService`) - 更新装饰品活动进度

**业务逻辑：**

- 点赞用户获得积分
- 文章作者收到点赞通知
- 更新装饰品活动进度（如需要点赞数）

---

### article.receivedLike

**触发时机：** 文章被点赞（给文章作者的奖励）

**触发位置：** `src/modules/article/article.service.ts`

**Payload：**

```typescript
{
  authorId: number; // 文章作者ID
  articleId: number; // 文章ID
  likerId: number; // 点赞用户ID
}
```

**监听器：**

- ✅ **积分系统** (`PointsEventService`) - 文章作者获得积分
- ✅ **等级系统** (`LevelEventService`) - 文章作者获得经验
- ✅ **成就系统** (`AchievementEventService`) - 更新获得点赞相关成就进度

**业务逻辑：**

- 文章作者获得被点赞积分
- 文章作者获得被点赞经验
- 更新成就进度（第一个点赞、100个点赞、1000个点赞）

---

### article.receivedComment

**触发时机：** 文章被评论（给文章作者的奖励）

**触发位置：** `src/modules/comment/comment.service.ts`

**Payload：**

```typescript
{
  authorId: number; // 文章作者ID
  articleId: number; // 文章ID
  commentId: number; // 评论ID
  commenterId: number; // 评论用户ID
}
```

**监听器：**

- ✅ **积分系统** (`PointsEventService`) - 文章作者获得积分
- ✅ **等级系统** (`LevelEventService`) - 文章作者获得经验

**业务逻辑：**

- 文章作者获得被评论积分
- 文章作者获得被评论经验

---

## 评论相关事件

### comment.created

**触发时机：** 用户发表评论

**触发位置：** `src/modules/comment/comment.service.ts`

**Payload：**

```typescript
{
  userId: number;      // 评论用户ID
  userName?: string;   // 评论用户名称
  articleId: number;   // 文章ID
  commentId: number;   // 评论ID
}
```

**监听器：**

- ✅ **积分系统** (`PointsEventService`) - 发表评论获得积分
- ✅ **等级系统** (`LevelEventService`) - 发表评论获得经验
- ✅ **成就系统** (`AchievementEventService`) - 更新评论相关成就进度
- ✅ **通知系统** (`NotificationEventService`) - 发送评论通知
- ✅ **装饰品系统** (`DecorationEventService`) - 更新装饰品活动进度

**业务逻辑：**

- 评论用户获得积分和经验
- 文章作者收到评论通知
- 更新成就进度（第一条评论、100条评论）
- 更新装饰品活动进度（如需要评论数）

---

### comment.liked

**触发时机：** 用户点赞评论

**触发位置：** `src/modules/comment/comment.service.ts`

**Payload：**

```typescript
{
  userId: number;       // 点赞用户ID
  userName?: string;    // 点赞用户名称
  commentId: number;    // 评论ID
  articleId?: number;   // 文章ID（可选）
}
```

**监听器：**

- ✅ **积分系统** (`PointsEventService`) - 点赞评论获得积分
- ✅ **通知系统** (`NotificationEventService`) - 发送点赞通知给评论作者

**业务逻辑：**

- 点赞用户获得积分
- 评论作者收到点赞通知

---

### comment.receivedLike

**触发时机：** 评论被点赞（给评论作者的奖励）

**触发位置：** `src/modules/comment/comment.service.ts`

**Payload：**

```typescript
{
  authorId: number; // 评论作者ID
  commentId: number; // 评论ID
  likerId: number; // 点赞用户ID
}
```

**监听器：**

- ✅ **积分系统** (`PointsEventService`) - 评论作者获得积分
- ✅ **等级系统** (`LevelEventService`) - 评论作者获得经验

**业务逻辑：**

- 评论作者获得被点赞积分
- 评论作者获得被点赞经验

---

## 用户相关事件

### user.dailyLogin

**触发时机：** 用户每日首次登录/签到

**触发位置：** `src/modules/user/user.service.ts`

**Payload：**

```typescript
{
  userId: number;           // 用户ID
  consecutiveDays?: number; // 连续登录天数（可选）
}
```

**监听器：**

- ✅ **积分系统** (`PointsEventService`) - 每日登录获得积分
- ✅ **等级系统** (`LevelEventService`) - 每日登录获得经验
- ✅ **成就系统** (`AchievementEventService`) - 更新连续登录成就进度

**业务逻辑：**

- 用户获得每日登录积分和经验
- 更新成就进度（连续登录7天、30天）

---

### user.followed

**触发时机：** 用户关注其他用户

**触发位置：** `src/modules/user/user.service.ts`

**Payload：**

```typescript
{
  userId: number; // 关注者ID
  targetUserId: number; // 被关注者ID
}
```

**监听器：**

- ✅ **等级系统** (`LevelEventService`) - 关注用户获得经验
- ✅ **成就系统** (`AchievementEventService`) - 更新关注相关成就进度
- ✅ **通知系统** (`NotificationEventService`) - 发送关注通知

**业务逻辑：**

- 关注者获得经验
- 更新成就进度（第一个关注、关注10个用户）
- 被关注者收到关注通知

---

### user.receivedFollow

**触发时机：** 用户被其他用户关注

**触发位置：** `src/modules/user/user.service.ts`

**Payload：**

```typescript
{
  userId: number; // 被关注者ID
  followerId: number; // 关注者ID
}
```

**监听器：**

- ✅ **成就系统** (`AchievementEventService`) - 更新粉丝相关成就进度

**业务逻辑：**

- 更新成就进度（第一个粉丝、100个粉丝、1000个粉丝）

---

### user.levelUp

**触发时机：** 用户等级提升

**触发位置：** `src/modules/user/level-event.service.ts`

**Payload：**

```typescript
{
  userId: number; // 用户ID
  level: number; // 新等级
}
```

**监听器：**

- ✅ **成就系统** (`AchievementEventService`) - 更新等级相关成就进度

**业务逻辑：**

- 更新成就进度（达到10级、30级、50级）

---

### user.profileCompleted

**触发时机：** 用户完善个人资料

**触发位置：** `src/modules/user/user.service.ts`

**Payload：**

```typescript
{
  userId: number; // 用户ID
}
```

**监听器：**

- ✅ **等级系统** (`LevelEventService`) - 完善资料获得经验（一次性）
- ✅ **成就系统** (`AchievementEventService`) - 更新资料完善成就

**业务逻辑：**

- 用户获得完善资料经验（仅一次）
- 解锁"完美档案"成就

---

### user.gainExp

**触发时机：** 用户获得经验值（通用事件）

**触发位置：** `src/modules/achievement/achievement.service.ts`

**Payload：**

```typescript
{
  userId: number; // 用户ID
  exp: number; // 经验值
  reason: string; // 获得原因
}
```

**监听器：**

- ✅ **等级系统** (`LevelEventService`) - 增加用户经验值

**业务逻辑：**

- 增加用户经验值
- 检查是否升级

---

## 成就相关事件

### achievement.completed

**触发时机：** 用户完成成就

**触发位置：** `src/modules/achievement/achievement.service.ts`

**Payload：**

```typescript
{
  userId: number; // 用户ID
  achievementId: number; // 成就ID
  achievementCode: string; // 成就代码
}
```

**监听器：**

- 暂无（可扩展用于发送通知、统计等）

**业务逻辑：**

- 自动创建成就勋章装饰品
- 添加到用户装饰品库

---

## 装饰品相关事件

### decoration.purchased

**触发时机：** 用户购买装饰品

**触发位置：** `src/modules/decoration/decoration.service.ts`

**Payload：**

```typescript
{
  userId: number; // 用户ID
  decorationId: number; // 装饰品ID
  amount: number; // 消费金额
}
```

**监听器：**

- ✅ **积分系统** (`PointsEventService`) - 扣除积分

**业务逻辑：**

- 扣除用户积分
- 添加装饰品到用户库

---

### decoration.grant

**触发时机：** 系统授予用户装饰品（如成就奖励）

**触发位置：** `src/modules/achievement/achievement.service.ts`

**Payload：**

```typescript
{
  userId: number; // 用户ID
  decorationId: number; // 装饰品ID
  obtainMethod: string; // 获取方式
}
```

**监听器：**

- 暂无（可扩展）

**业务逻辑：**

- 添加装饰品到用户库
- 记录获取方式

---

## 系统相关事件

### membership.purchased

**触发时机：** 用户购买会员

**触发位置：** `src/modules/order/order.service.ts`

**Payload：**

```typescript
{
  userId: number; // 用户ID
  orderId: number; // 订单ID
}
```

**监听器：**

- ✅ **等级系统** (`LevelEventService`) - 购买会员获得经验
- ✅ **成就系统** (`AchievementEventService`) - 解锁会员成就

**业务逻辑：**

- 用户获得购买会员经验
- 解锁"尊贵会员"成就

---

### config.updated

**触发时机：** 系统配置更新

**触发位置：** `src/modules/config/config.service.ts`

**Payload：**

```typescript
{
  group?: string;  // 配置组（可选）
}
```

**监听器：**

- ✅ **支付系统** (`PaymentService`) - 重新初始化支付SDK

**业务逻辑：**

- 重新加载支付配置
- 重新初始化支付SDK

---

### system.notification

**触发时机：** 系统发送通知

**触发位置：** 各个模块

**Payload：**

```typescript
{
  userId: number;      // 接收用户ID
  title: string;       // 通知标题
  content: string;     // 通知内容
  type?: string;       // 通知类型
  relatedId?: number;  // 关联ID
}
```

**监听器：**

- ✅ **通知系统** (`NotificationEventService`) - 创建系统通知

**业务逻辑：**

- 创建系统通知记录
- 推送通知给用户

---

### task.progress

**触发时机：** 任务进度更新

**触发位置：** 各个模块

**Payload：**

```typescript
{
  userId: number;      // 用户ID
  taskCode: string;    // 任务代码
  increment?: number;  // 增量（可选，默认1）
}
```

**监听器：**

- ✅ **积分系统** (`PointsEventService`) - 更新任务进度

**业务逻辑：**

- 更新用户任务进度
- 检查任务是否完成
- 发放任务奖励

---

## 事件监听器汇总

### 积分系统 (PointsEventService)

监听的事件：

- `article.created` - 发布文章获得积分
- `article.liked` - 点赞文章获得积分
- `article.receivedLike` - 文章被点赞，作者获得积分
- `article.receivedComment` - 文章被评论，作者获得积分
- `comment.created` - 发表评论获得积分
- `comment.liked` - 点赞评论获得积分
- `comment.receivedLike` - 评论被点赞，作者获得积分
- `user.dailyLogin` - 每日登录获得积分
- `decoration.purchased` - 购买装饰品扣除积分
- `task.progress` - 更新任务进度

### 等级系统 (LevelEventService)

监听的事件：

- `article.created` - 发布文章获得经验
- `article.receivedLike` - 文章被点赞，作者获得经验
- `article.receivedComment` - 文章被评论，作者获得经验
- `comment.created` - 发表评论获得经验
- `comment.receivedLike` - 评论被点赞，作者获得经验
- `user.dailyLogin` - 每日登录获得经验
- `user.followed` - 关注用户获得经验
- `membership.purchased` - 购买会员获得经验
- `user.profileCompleted` - 完善资料获得经验

### 成就系统 (AchievementEventService)

监听的事件：

- `article.created` - 更新文章发布成就
- `article.receivedLike` - 更新获得点赞成就
- `comment.created` - 更新评论发布成就
- `user.followed` - 更新关注用户成就
- `user.receivedFollow` - 更新获得粉丝成就
- `user.dailyLogin` - 更新连续登录成就
- `user.levelUp` - 更新等级成就
- `membership.purchased` - 解锁会员成就
- `user.profileCompleted` - 解锁资料完善成就

### 通知系统 (NotificationEventService)

监听的事件：

- `article.liked` - 发送文章点赞通知
- `comment.liked` - 发送评论点赞通知
- `comment.created` - 发送评论通知
- `user.followed` - 发送关注通知
- `system.notification` - 发送系统通知

### 装饰品系统 (DecorationEventService)

监听的事件：

- `article.liked` - 更新装饰品活动进度（点赞）
- `comment.created` - 更新装饰品活动进度（评论）

### 支付系统 (PaymentService)

监听的事件：

- `config.updated` - 重新初始化支付SDK

---

## 事件使用示例

### 触发事件

```typescript
import { EventEmitter2 } from "@nestjs/event-emitter";

@Injectable()
export class ArticleService {
  constructor(private eventEmitter: EventEmitter2) {}

  async createArticle(dto: CreateArticleDto, author: User) {
    // ... 创建文章逻辑

    // 触发文章创建事件
    this.eventEmitter.emit("article.created", {
      userId: author.id,
      articleId: savedArticle.id,
    });

    return savedArticle;
  }
}
```

### 监听事件

```typescript
import { OnEvent } from "@nestjs/event-emitter";

@Injectable()
export class PointsEventService {
  @OnEvent("article.created")
  async handleArticleCreated(payload: { userId: number; articleId: number }) {
    // 处理事件逻辑
    await this.pointsService.addPointsByRule(payload.userId, "ARTICLE_PUBLISH");
  }
}
```

---

## 事件命名规范

### 格式

```
<模块>.<动作>
```

### 示例

- `article.created` - 文章被创建
- `article.liked` - 文章被点赞
- `article.receivedLike` - 文章收到点赞（强调接收方）
- `user.followed` - 用户关注了其他人
- `user.receivedFollow` - 用户被其他人关注

### 规则

1. 使用小写字母和点号分隔
2. 模块名使用单数形式
3. 动作使用过去式
4. 如果强调接收方，使用 `received` 前缀

---

## 扩展建议

### 添加新事件

1. 在触发位置使用 `eventEmitter.emit()`
2. 创建或更新事件监听器服务
3. 使用 `@OnEvent()` 装饰器监听事件
4. 更新本文档

### 事件监听器最佳实践

1. **异步处理** - 使用 `async/await`
2. **错误处理** - 使用 `try-catch` 捕获异常
3. **日志记录** - 记录事件处理日志
4. **幂等性** - 确保重复触发不会产生副作用
5. **性能优化** - 避免在事件处理中执行耗时操作

### 示例

```typescript
@OnEvent('article.created')
async handleArticleCreated(payload: { userId: number; articleId: number }) {
  try {
    // 异步处理
    await this.pointsService.addPoints(payload.userId, 10);

    // 日志记录
    console.log(`用户 ${payload.userId} 发布文章获得积分`);
  } catch (error) {
    // 错误处理
    console.error('处理文章创建事件失败:', error);
  }
}
```

---

## 总结

系统当前共有 **20+** 个事件，涵盖：

- 文章相关：5个事件
- 评论相关：3个事件
- 用户相关：6个事件
- 成就相关：1个事件
- 装饰品相关：2个事件
- 系统相关：3个事件

这些事件通过 **6个事件监听器服务** 处理：

- 积分系统
- 等级系统
- 成就系统
- 通知系统
- 装饰品系统
- 支付系统

事件驱动架构使系统各模块解耦，便于扩展和维护。
