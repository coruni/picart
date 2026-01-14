# WebSocket 消息通知系统使用指南

## 概述

本系统提供了完整的 WebSocket 实时消息通知功能，支持：
- 私信消息
- 系统通知
- 广播消息
- 实时推送
- 已读/未读管理
- 多种通知类型（评论、点赞、关注、订单等）

## 连接配置

### 连接地址
```
ws://localhost:3000/ws-message
```

### 认证方式

支持三种方式传递 JWT Token：

1. **通过 auth 对象**（推荐）
```javascript
const socket = io('ws://localhost:3000/ws-message', {
  auth: {
    token: 'your_jwt_token'
  }
});
```

2. **通过 query 参数**
```javascript
const socket = io('ws://localhost:3000/ws-message', {
  query: {
    token: 'your_jwt_token'
  }
});
```

3. **通过 headers**
```javascript
const socket = io('ws://localhost:3000/ws-message', {
  extraHeaders: {
    Authorization: 'Bearer your_jwt_token'
  }
});
```

## 客户端示例

### 浏览器端（使用 socket.io-client）

```html
<!DOCTYPE html>
<html>
<head>
  <title>WebSocket 消息通知测试</title>
  <script src="https://cdn.socket.io/4.5.4/socket.io.min.js"></script>
</head>
<body>
  <h1>WebSocket 消息通知测试</h1>
  
  <div>
    <h2>连接状态</h2>
    <p id="status">未连接</p>
  </div>

  <div>
    <h2>发送消息</h2>
    <input type="text" id="receiverId" placeholder="接收者ID" />
    <textarea id="content" placeholder="消息内容"></textarea>
    <button onclick="sendMessage()">发送</button>
  </div>

  <div>
    <h2>消息列表</h2>
    <div id="messages"></div>
  </div>

  <script>
    // 替换为实际的 JWT Token
    const token = 'your_jwt_token_here';
    
    // 连接 WebSocket
    const socket = io('ws://localhost:3000/ws-message', {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    // 连接成功
    socket.on('connected', (data) => {
      console.log('连接成功:', data);
      document.getElementById('status').textContent = '已连接';
      document.getElementById('status').style.color = 'green';
    });

    // 连接错误
    socket.on('error', (error) => {
      console.error('连接错误:', error);
      document.getElementById('status').textContent = '连接失败: ' + error.message;
      document.getElementById('status').style.color = 'red';
    });

    // 接收新消息
    socket.on('newMessage', (message) => {
      console.log('收到新消息:', message);
      addMessageToList(message);
    });

    // 接收未读数量
    socket.on('unreadCount', (count) => {
      console.log('未读消息数量:', count);
    });

    // 发送消息
    function sendMessage() {
      const receiverId = document.getElementById('receiverId').value;
      const content = document.getElementById('content').value;
      
      socket.emit('sendMessage', {
        toUserId: receiverId ? parseInt(receiverId) : undefined,
        content,
        type: 'private'
      }, (response) => {
        console.log('发送响应:', response);
      });
    }

    // 添加消息到列表
    function addMessageToList(message) {
      const messagesDiv = document.getElementById('messages');
      const messageEl = document.createElement('div');
      messageEl.style.border = '1px solid #ccc';
      messageEl.style.padding = '10px';
      messageEl.style.margin = '5px 0';
      messageEl.innerHTML = `
        <strong>${message.sender?.nickname || '系统'}</strong>
        <p>${message.content}</p>
        <small>${new Date(message.createdAt).toLocaleString()}</small>
      `;
      messagesDiv.insertBefore(messageEl, messagesDiv.firstChild);
    }

    // 获取历史消息
    socket.emit('getHistory', { page: 1, limit: 20 });

    // 获取未读数量
    socket.emit('getUnreadCount');

    // Ping-Pong 心跳测试
    setInterval(() => {
      socket.emit('ping');
    }, 30000);

    socket.on('pong', (data) => {
      console.log('Pong:', data);
    });
  </script>
</body>
</html>
```

### Node.js 客户端

```javascript
const io = require('socket.io-client');

const token = 'your_jwt_token_here';

const socket = io('ws://localhost:3000/ws-message', {
  auth: { token },
  transports: ['websocket', 'polling']
});

// 连接成功
socket.on('connected', (data) => {
  console.log('✅ 连接成功:', data);
  
  // 获取历史消息
  socket.emit('getHistory', { page: 1, limit: 20 });
  
  // 获取未读数量
  socket.emit('getUnreadCount');
});

// 连接错误
socket.on('error', (error) => {
  console.error('❌ 连接错误:', error);
});

// 接收新消息
socket.on('newMessage', (message) => {
  console.log('📨 收到新消息:', message);
});

// 接收历史消息
socket.on('history', (data) => {
  console.log('📜 历史消息:', data);
});

// 接收未读数量
socket.on('unreadCount', (count) => {
  console.log('🔔 未读消息数量:', count);
});

// 发送消息
function sendMessage(toUserId, content) {
  socket.emit('sendMessage', {
    toUserId,
    content,
    type: 'private'
  }, (response) => {
    console.log('发送响应:', response);
  });
}

// 标记消息为已读
function markAsRead(messageId) {
  socket.emit('readMessage', { messageId }, (response) => {
    console.log('标记已读响应:', response);
  });
}

// 标记所有消息为已读
function markAllAsRead() {
  socket.emit('markAllAsRead', {}, (response) => {
    console.log('标记所有已读响应:', response);
  });
}

// 示例：发送消息
setTimeout(() => {
  sendMessage(2, '你好，这是一条测试消息！');
}, 2000);
```

### React 客户端示例

```jsx
import { useEffect, useState } from 'react';
import io from 'socket.io-client';

function MessageNotification() {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // 从 localStorage 或其他地方获取 token
    const token = localStorage.getItem('token');
    
    // 创建 socket 连接
    const newSocket = io('ws://localhost:3000/ws-message', {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    // 连接成功
    newSocket.on('connected', (data) => {
      console.log('连接成功:', data);
      setConnected(true);
      
      // 获取未读数量
      newSocket.emit('getUnreadCount');
    });

    // 连接错误
    newSocket.on('error', (error) => {
      console.error('连接错误:', error);
      setConnected(false);
    });

    // 接收新消息
    newSocket.on('newMessage', (message) => {
      console.log('收到新消息:', message);
      setMessages(prev => [message, ...prev]);
      setUnreadCount(prev => prev + 1);
      
      // 显示通知
      if (Notification.permission === 'granted') {
        new Notification(message.title || '新消息', {
          body: message.content,
          icon: message.sender?.avatar
        });
      }
    });

    // 接收未读数量
    newSocket.on('unreadCount', (count) => {
      setUnreadCount(count.total);
    });

    setSocket(newSocket);

    // 清理
    return () => {
      newSocket.close();
    };
  }, []);

  // 发送消息
  const sendMessage = (toUserId, content) => {
    if (socket) {
      socket.emit('sendMessage', {
        toUserId,
        content,
        type: 'private'
      });
    }
  };

  // 标记消息为已读
  const markAsRead = (messageId) => {
    if (socket) {
      socket.emit('readMessage', { messageId });
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  return (
    <div>
      <div>
        状态: {connected ? '✅ 已连接' : '❌ 未连接'}
        {unreadCount > 0 && <span> | 未读: {unreadCount}</span>}
      </div>
      
      <div>
        {messages.map(msg => (
          <div key={msg.id} onClick={() => markAsRead(msg.id)}>
            <strong>{msg.sender?.nickname || '系统'}</strong>
            <p>{msg.content}</p>
            <small>{new Date(msg.createdAt).toLocaleString()}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

export default MessageNotification;
```

## WebSocket 事件列表

### 客户端发送事件

| 事件名 | 参数 | 说明 |
|--------|------|------|
| `join` | 无 | 手动加入用户房间（连接时自动加入） |
| `leave` | 无 | 离开用户房间 |
| `sendMessage` | `{ content, toUserId?, receiverIds?, isBroadcast?, type? }` | 发送消息 |
| `getHistory` | `{ page?, limit? }` | 获取历史消息 |
| `getUnreadCount` | 无 | 获取未读消息数量 |
| `markAllAsRead` | `{ type?, isBroadcast? }` | 标记所有消息为已读 |
| `batchOperation` | `{ messageIds, action }` | 批量操作消息 |
| `readMessage` | `{ messageId }` | 标记单条消息为已读 |
| `getProfile` | 无 | 获取当前用户信息 |
| `ping` | 无 | 心跳检测 |

### 服务端推送事件

| 事件名 | 数据 | 说明 |
|--------|------|------|
| `connected` | `{ message, user }` | 连接成功 |
| `error` | `{ message, code }` | 错误信息 |
| `newMessage` | `Message` | 新消息通知 |
| `history` | `PaginatedList<Message>` | 历史消息列表 |
| `unreadCount` | `{ personal, broadcast, total }` | 未读消息数量 |
| `joined` | `{ userId, message, room }` | 加入房间成功 |
| `leaved` | `{ userId, message, room }` | 离开房间成功 |
| `read` | `{ messageId }` | 消息已读确认 |
| `allMarkedAsRead` | `{ success, message }` | 全部标记已读确认 |
| `batchOperationResult` | `{ success, message }` | 批量操作结果 |
| `profile` | `User` | 用户信息 |
| `pong` | `{ message, userId, timestamp }` | 心跳响应 |

## REST API 接口

除了 WebSocket，系统还提供了完整的 REST API：

### 创建消息
```http
POST /api/v1/message
Authorization: Bearer {token}
Content-Type: application/json

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

### 获取单条消息
```http
GET /api/v1/message/:id
Authorization: Bearer {token}
```

### 标记消息为已读
```http
POST /api/v1/message/:id/read
Authorization: Bearer {token}
```

### 标记所有消息为已读
```http
POST /api/v1/message/read-all
Authorization: Bearer {token}
Content-Type: application/json

{
  "type": "private",
  "isBroadcast": false
}
```

### 获取未读消息数量
```http
GET /api/v1/message/unread/count
Authorization: Bearer {token}
```

### 批量操作消息
```http
POST /api/v1/message/batch
Authorization: Bearer {token}
Content-Type: application/json

{
  "messageIds": [1, 2, 3],
  "action": "read"
}
```

## 通知服务使用

### 基础通知服务（MessageNotificationService）

```typescript
import { MessageNotificationService } from './modules/message/message-notification.service';

// 注入服务
constructor(
  private readonly messageNotificationService: MessageNotificationService
) {}

// 发送系统通知
await this.messageNotificationService.sendSystemNotification(
  '系统维护通知',
  '系统将于今晚 22:00 进行维护',
  [1, 2, 3], // 接收者ID列表，不传或空数组表示广播
  { type: 'maintenance' }
);

// 发送欢迎消息
await this.messageNotificationService.sendWelcomeMessage(userId, username);

// 发送订单通知
await this.messageNotificationService.sendOrderStatusNotification(
  userId,
  orderNo,
  'PAID',
  100
);

// 发送支付成功通知
await this.messageNotificationService.sendPaymentSuccessNotification(
  userId,
  orderNo,
  100,
  'alipay'
);

// 发送余额变动通知
await this.messageNotificationService.sendBalanceChangeNotification(
  userId,
  50,
  150,
  '充值'
);

// 发送文章通知
await this.messageNotificationService.sendArticleNotification(
  userId,
  '我的文章标题',
  'published'
);
```

### 增强通知服务（EnhancedNotificationService）

支持根据用户配置发送多渠道通知：

```typescript
import { EnhancedNotificationService } from './modules/message/enhanced-notification.service';

// 注入服务
constructor(
  private readonly enhancedNotificationService: EnhancedNotificationService
) {}

// 发送评论通知
await this.enhancedNotificationService.sendCommentNotification(
  userId,
  '张三',
  '我的文章',
  '这是一条评论',
  articleId,
  commentId
);

// 发送点赞通知
await this.enhancedNotificationService.sendLikeNotification(
  userId,
  '李四',
  'article',
  '我的文章',
  articleId
);

// 发送关注通知
await this.enhancedNotificationService.sendFollowNotification(
  userId,
  '王五'
);

// 发送私信通知
await this.enhancedNotificationService.sendMessageNotification(
  userId,
  '赵六',
  '你好'
);

// 发送订单通知
await this.enhancedNotificationService.sendOrderNotification(
  userId,
  orderNo,
  'PAID',
  100
);

// 发送支付通知
await this.enhancedNotificationService.sendPaymentNotification(
  userId,
  orderNo,
  100,
  'alipay'
);
```

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

## 消息类型

### 消息类型（type）
- `private`: 私信消息
- `system`: 系统消息
- `notification`: 通知消息

### 通知类型（metadata.notificationType）
- `system`: 系统通知
- `comment`: 评论通知
- `like`: 点赞通知
- `follow`: 关注通知
- `message`: 私信通知
- `order`: 订单通知
- `payment`: 支付通知
- `invite`: 邀请通知

## 消息元数据（metadata）

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

## 错误处理

### 错误代码

| 错误代码 | 说明 |
|---------|------|
| `AUTH_FAILED` | 认证失败 |
| `USER_NOT_FOUND` | 用户不存在 |
| `NO_PERMISSION_BROADCAST` | 无权限发送广播消息 |
| `MESSAGE_SEND_FAILED` | 消息发送失败 |
| `HISTORY_FETCH_FAILED` | 获取历史消息失败 |
| `UNREAD_COUNT_FETCH_FAILED` | 获取未读数量失败 |
| `MARK_ALL_READ_FAILED` | 标记所有已读失败 |
| `BATCH_OPERATION_FAILED` | 批量操作失败 |
| `MARK_READ_FAILED` | 标记已读失败 |

### 错误处理示例

```javascript
socket.on('error', (error) => {
  switch (error.code) {
    case 'AUTH_FAILED':
      // 重新登录
      console.error('认证失败，请重新登录');
      break;
    case 'NO_PERMISSION_BROADCAST':
      console.error('无权限发送广播消息');
      break;
    default:
      console.error('错误:', error.message);
  }
});
```

## 最佳实践

### 1. 连接管理
- 使用心跳机制保持连接活跃
- 实现自动重连机制
- 处理网络断开和恢复

```javascript
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

socket.on('disconnect', () => {
  console.log('连接断开');
  
  if (reconnectAttempts < maxReconnectAttempts) {
    setTimeout(() => {
      reconnectAttempts++;
      socket.connect();
    }, 1000 * reconnectAttempts);
  }
});

socket.on('connect', () => {
  reconnectAttempts = 0;
  console.log('连接成功');
});
```

### 2. 消息去重
- 使用消息ID进行去重
- 避免重复显示相同消息

```javascript
const messageIds = new Set();

socket.on('newMessage', (message) => {
  if (!messageIds.has(message.id)) {
    messageIds.add(message.id);
    displayMessage(message);
  }
});
```

### 3. 性能优化
- 使用分页加载历史消息
- 限制内存中保存的消息数量
- 使用虚拟滚动显示大量消息

### 4. 安全性
- 始终使用 HTTPS/WSS 在生产环境
- 定期刷新 JWT Token
- 验证消息来源

## 测试工具

### Postman WebSocket 测试

1. 创建新的 WebSocket 请求
2. URL: `ws://localhost:3000/ws-message`
3. 在 Headers 中添加：
   ```
   Authorization: Bearer your_jwt_token
   ```
4. 连接后发送消息：
   ```json
   {
     "event": "sendMessage",
     "data": {
       "content": "测试消息",
       "toUserId": 2
     }
   }
   ```

### 在线测试工具

可以使用以下在线工具测试 WebSocket：
- [WebSocket King](https://websocketking.com/)
- [Piehost WebSocket Tester](https://www.piesocket.com/websocket-tester)

## 常见问题

### Q: 连接失败怎么办？
A: 检查以下几点：
1. JWT Token 是否有效
2. 服务器是否正常运行
3. 网络连接是否正常
4. CORS 配置是否正确

### Q: 收不到消息怎么办？
A: 检查以下几点：
1. 是否成功连接
2. 是否正确加入房间
3. 消息接收者ID是否正确
4. 用户通知配置是否启用

### Q: 如何实现消息持久化？
A: 系统已经实现了消息持久化，所有消息都保存在数据库中。

### Q: 如何实现离线消息？
A: 用户离线时，消息会保存在数据库中。用户上线后，通过 `getHistory` 事件获取历史消息。

## 更新日志

### v1.0.0
- ✅ 基础 WebSocket 连接
- ✅ JWT 认证
- ✅ 私信消息
- ✅ 系统通知
- ✅ 广播消息
- ✅ 已读/未读管理
- ✅ 历史消息查询
- ✅ 批量操作
- ✅ 多种通知类型
- ✅ 用户通知配置
- ✅ REST API 接口

## 技术支持

如有问题，请联系开发团队或提交 Issue。
