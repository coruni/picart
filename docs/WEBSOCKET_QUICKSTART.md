# WebSocket 消息通知 - 快速入门

## 5 分钟快速上手

### 1. 启动服务 (1分钟)

```bash
# 启动开发服务器
npm run dev
```

服务启动后，WebSocket 服务将在以下地址可用：
```
ws://localhost:3000/ws-message
```

### 2. 获取 JWT Token (1分钟)

首先需要登录获取 JWT Token：

```bash
# 使用 curl 登录
curl -X POST http://localhost:3000/api/v1/user/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "your_username",
    "password": "your_password"
  }'
```

响应示例：
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": { ... }
  }
}
```

保存返回的 `token`，后续步骤需要使用。

### 3. 测试 WebSocket 连接 (3分钟)

#### 方式一：使用 Web 测试页面（推荐）

1. 打开浏览器访问：
   ```
   http://localhost:3000/static/public/websocket-test.html
   ```

2. 在"JWT Token"输入框中粘贴你的 token

3. 点击"连接"按钮

4. 连接成功后，你会看到：
   - 状态变为"✅ 已连接"
   - 自动获取历史消息
   - 自动获取未读数量

5. 尝试发送消息：
   - 在"接收者ID"输入框输入目标用户ID（留空为广播）
   - 在"消息内容"输入框输入消息
   - 点击"发送消息"

#### 方式二：使用 Node.js 测试脚本

1. 安装客户端依赖：
   ```bash
   npm install socket.io-client
   ```

2. 编辑 `test-websocket-client.js`，替换 TOKEN：
   ```javascript
   const TOKEN = 'your_jwt_token_here'; // 替换为你的 token
   ```

3. 运行测试脚本：
   ```bash
   node test-websocket-client.js
   ```

4. 使用交互式命令：
   ```
   > help                          # 查看帮助
   > send 2 你好                   # 发送消息给用户2
   > broadcast 大家好              # 发送广播消息
   > history                       # 获取历史消息
   > unread                        # 获取未读数量
   > ping                          # 测试连接
   ```

## 常用场景示例

### 场景 1：发送私信

```javascript
// 浏览器端
socket.emit('sendMessage', {
  toUserId: 2,
  content: '你好，这是一条私信',
  type: 'private'
});
```

### 场景 2：发送系统通知

```javascript
// 服务端代码
await this.messageNotificationService.sendSystemNotification(
  '系统维护通知',
  '系统将于今晚 22:00 进行维护',
  [1, 2, 3] // 接收者ID列表
);
```

### 场景 3：发送广播消息

```javascript
// 浏览器端
socket.emit('sendMessage', {
  content: '这是一条广播消息',
  isBroadcast: true
});
```

### 场景 4：获取未读消息

```javascript
// 浏览器端
socket.emit('getUnreadCount');

socket.on('unreadCount', (count) => {
  console.log('未读消息:', count);
  // { personal: 5, broadcast: 2, total: 7 }
});
```

### 场景 5：标记消息为已读

```javascript
// 浏览器端
socket.emit('readMessage', { messageId: 123 });
```

## 在业务代码中集成

### 1. 导入消息模块

```typescript
// your.module.ts
import { Module } from '@nestjs/common';
import { MessageModule } from '../message/message.module';

@Module({
  imports: [MessageModule],
})
export class YourModule {}
```

### 2. 注入通知服务

```typescript
// your.service.ts
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
// 评论通知
await this.enhancedNotificationService.sendCommentNotification(
  userId,           // 接收者ID
  '张三',           // 评论者昵称
  '我的文章',       // 文章标题
  '这是评论内容',   // 评论内容
  articleId,        // 文章ID
  commentId         // 评论ID
);

// 点赞通知
await this.enhancedNotificationService.sendLikeNotification(
  userId,           // 接收者ID
  '李四',           // 点赞者昵称
  'article',        // 目标类型
  '我的文章',       // 目标标题
  articleId         // 目标ID
);

// 关注通知
await this.enhancedNotificationService.sendFollowNotification(
  userId,           // 接收者ID
  '王五'            // 关注者昵称
);

// 订单通知
await this.enhancedNotificationService.sendOrderNotification(
  userId,           // 接收者ID
  'ORDER123',       // 订单号
  'PAID',           // 订单状态
  100               // 订单金额
);
```

## 客户端集成示例

### React 示例

```jsx
import { useEffect, useState } from 'react';
import io from 'socket.io-client';

function MessageNotification() {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const newSocket = io('ws://localhost:3000/ws-message', {
      auth: { token }
    });

    newSocket.on('connected', () => {
      console.log('连接成功');
      newSocket.emit('getUnreadCount');
    });

    newSocket.on('newMessage', (message) => {
      setMessages(prev => [message, ...prev]);
      setUnreadCount(prev => prev + 1);
    });

    newSocket.on('unreadCount', (count) => {
      setUnreadCount(count.total);
    });

    setSocket(newSocket);
    return () => newSocket.close();
  }, []);

  return (
    <div>
      <h2>未读消息: {unreadCount}</h2>
      <div>
        {messages.map(msg => (
          <div key={msg.id}>
            <strong>{msg.sender?.nickname || '系统'}</strong>
            <p>{msg.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Vue 示例

```vue
<template>
  <div>
    <h2>未读消息: {{ unreadCount }}</h2>
    <div v-for="msg in messages" :key="msg.id">
      <strong>{{ msg.sender?.nickname || '系统' }}</strong>
      <p>{{ msg.content }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import io from 'socket.io-client';

const socket = ref(null);
const messages = ref([]);
const unreadCount = ref(0);

onMounted(() => {
  const token = localStorage.getItem('token');
  socket.value = io('ws://localhost:3000/ws-message', {
    auth: { token }
  });

  socket.value.on('connected', () => {
    console.log('连接成功');
    socket.value.emit('getUnreadCount');
  });

  socket.value.on('newMessage', (message) => {
    messages.value.unshift(message);
    unreadCount.value++;
  });

  socket.value.on('unreadCount', (count) => {
    unreadCount.value = count.total;
  });
});

onUnmounted(() => {
  socket.value?.close();
});
</script>
```

## REST API 快速参考

### 获取消息列表

```bash
curl -X GET "http://localhost:3000/api/v1/message?page=1&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 创建消息

```bash
curl -X POST "http://localhost:3000/api/v1/message" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "消息内容",
    "receiverId": 2,
    "type": "private"
  }'
```

### 获取未读数量

```bash
curl -X GET "http://localhost:3000/api/v1/message/unread/count" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 标记消息为已读

```bash
curl -X POST "http://localhost:3000/api/v1/message/123/read" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 标记所有消息为已读

```bash
curl -X POST "http://localhost:3000/api/v1/message/read-all" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## 常见问题

### Q: 连接失败怎么办？

A: 检查以下几点：
1. 确认服务已启动
2. 确认 Token 有效
3. 确认 WebSocket 地址正确
4. 查看浏览器控制台错误信息

### Q: 收不到消息怎么办？

A: 检查以下几点：
1. 确认已成功连接
2. 确认接收者ID正确
3. 确认用户通知配置已启用
4. 查看服务端日志

### Q: 如何调试？

A: 使用以下方法：
1. 打开浏览器开发者工具
2. 查看 Network -> WS 标签
3. 查看 WebSocket 连接和消息
4. 使用测试页面或测试脚本

## 下一步

- 📖 阅读 [完整使用指南](./WEBSOCKET_GUIDE.md)
- 🔧 查看 [集成指南](./WEBSOCKET_INTEGRATION.md)
- 📝 查看 [完成总结](./WEBSOCKET_SUMMARY.md)
- 🎯 查看 [项目概览](./PROJECT_OVERVIEW.md)

## 获取帮助

- 查看文档
- 查看示例代码
- 联系开发团队
- 提交 Issue

---

**提示**: 如果你是第一次使用，建议先使用 Web 测试页面熟悉功能，然后再集成到你的应用中。
