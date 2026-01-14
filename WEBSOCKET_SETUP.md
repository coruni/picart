# WebSocket 消息通知系统 - 快速安装和测试

## 🎯 目标

在 5 分钟内完成 WebSocket 消息通知系统的安装和测试。

## 📋 前提条件

- ✅ 项目已启动（`npm run dev`）
- ✅ 数据库已配置
- ✅ 已有测试用户账号

## 🚀 快速测试步骤

### 步骤 1: 获取 JWT Token (1分钟)

使用任意 HTTP 客户端登录获取 Token：

**使用 curl:**
```bash
curl -X POST http://localhost:3000/api/v1/user/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "your_username",
    "password": "your_password"
  }'
```

**使用 Postman:**
1. 创建 POST 请求：`http://localhost:3000/api/v1/user/login`
2. Body 选择 JSON：
   ```json
   {
     "username": "your_username",
     "password": "your_password"
   }
   ```
3. 发送请求，复制返回的 `token`

**响应示例:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": { ... }
  }
}
```

### 步骤 2: 使用 Web 测试页面 (2分钟)

1. **打开测试页面**
   ```
   http://localhost:3000/static/public/websocket-test.html
   ```

2. **输入配置**
   - WebSocket 地址: `ws://localhost:3000/ws-message`（默认已填写）
   - JWT Token: 粘贴步骤1获取的 token

3. **点击连接**
   - 点击"连接"按钮
   - 等待状态变为"✅ 已连接"

4. **测试功能**
   - 查看自动获取的历史消息
   - 查看未读消息数量
   - 尝试发送测试消息

### 步骤 3: 测试消息发送 (2分钟)

#### 测试私信
1. 在"接收者ID"输入框输入另一个用户的ID（如：2）
2. 在"消息内容"输入框输入：`你好，这是一条测试消息`
3. 点击"发送消息"
4. 查看消息列表中是否出现新消息

#### 测试广播消息
1. 清空"接收者ID"输入框
2. 在"消息内容"输入框输入：`这是一条广播消息`
3. 点击"发送消息"
4. 所有在线用户都会收到此消息

#### 测试其他功能
- 点击"获取历史"按钮，查看历史消息
- 点击"未读数量"按钮，查看未读消息统计
- 点击"全部已读"按钮，标记所有消息为已读
- 点击"Ping测试"按钮，测试连接状态

## ✅ 验证成功标志

如果看到以下内容，说明系统运行正常：

1. **连接成功**
   - 状态显示"✅ 已连接"
   - 日志显示"连接成功"消息
   - 显示当前用户信息

2. **消息功能正常**
   - 能够发送消息
   - 能够接收消息
   - 消息列表正常显示

3. **统计功能正常**
   - 显示未读消息数量
   - 显示总消息数
   - 显示广播消息数

## 🔧 使用 Node.js 测试脚本（可选）

如果你想使用命令行测试：

### 1. 安装依赖
```bash
npm install socket.io-client
```

### 2. 编辑测试脚本
打开 `test-websocket-client.js`，找到这一行：
```javascript
const TOKEN = 'your_jwt_token_here';
```
替换为你的实际 token。

### 3. 运行测试
```bash
node test-websocket-client.js
```

### 4. 使用交互式命令
```
> help                          # 查看帮助
> send 2 你好                   # 发送消息给用户2
> broadcast 大家好              # 发送广播消息
> history                       # 获取历史消息
> unread                        # 获取未读数量
> ping                          # 测试连接
> exit                          # 退出
```

## 📱 客户端集成示例

### React 示例

```jsx
import { useEffect, useState } from 'react';
import io from 'socket.io-client';

function App() {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const newSocket = io('ws://localhost:3000/ws-message', {
      auth: { token }
    });

    newSocket.on('connected', () => {
      console.log('连接成功');
    });

    newSocket.on('newMessage', (message) => {
      setMessages(prev => [message, ...prev]);
    });

    setSocket(newSocket);
    return () => newSocket.close();
  }, []);

  return (
    <div>
      <h1>消息列表</h1>
      {messages.map(msg => (
        <div key={msg.id}>
          <strong>{msg.sender?.nickname || '系统'}</strong>
          <p>{msg.content}</p>
        </div>
      ))}
    </div>
  );
}
```

### Vue 示例

```vue
<template>
  <div>
    <h1>消息列表</h1>
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

onMounted(() => {
  const token = localStorage.getItem('token');
  socket.value = io('ws://localhost:3000/ws-message', {
    auth: { token }
  });

  socket.value.on('connected', () => {
    console.log('连接成功');
  });

  socket.value.on('newMessage', (message) => {
    messages.value.unshift(message);
  });
});

onUnmounted(() => {
  socket.value?.close();
});
</script>
```

## 🐛 常见问题

### Q1: 连接失败，显示"认证失败"

**原因**: Token 无效或已过期

**解决方案**:
1. 重新登录获取新的 Token
2. 确认 Token 没有包含 "Bearer " 前缀
3. 检查 Token 是否完整复制

### Q2: 连接成功但收不到消息

**原因**: 可能是权限或配置问题

**解决方案**:
1. 检查用户通知配置是否启用
2. 确认消息接收者ID正确
3. 查看服务端日志

### Q3: 测试页面无法访问

**原因**: 静态文件路径配置问题

**解决方案**:
1. 确认 `public/websocket-test.html` 文件存在
2. 确认服务已启动
3. 尝试访问 `http://localhost:3000/static/public/websocket-test.html`

### Q4: Node.js 测试脚本报错

**原因**: 缺少依赖或 Token 未配置

**解决方案**:
1. 运行 `npm install socket.io-client`
2. 确认已替换脚本中的 TOKEN
3. 检查 WebSocket 地址是否正确

## 📚 下一步

测试成功后，你可以：

1. **阅读详细文档**
   - [快速入门](./docs/WEBSOCKET_QUICKSTART.md)
   - [使用指南](./docs/WEBSOCKET_GUIDE.md)
   - [集成指南](./docs/WEBSOCKET_INTEGRATION.md)

2. **集成到业务模块**
   - 在评论模块中发送通知
   - 在点赞功能中发送通知
   - 在订单模块中发送通知

3. **自定义通知**
   - 创建自定义通知类型
   - 配置用户通知偏好
   - 实现多渠道通知

## 🎉 完成！

恭喜！你已经成功完成了 WebSocket 消息通知系统的安装和测试。

如有问题，请查看：
- [完整文档](./docs/WEBSOCKET_GUIDE.md)
- [常见问题](./docs/WEBSOCKET_GUIDE.md#常见问题)
- [功能检查清单](./docs/WEBSOCKET_CHECKLIST.md)

---

**需要帮助？**
- 查看文档
- 提交 Issue
- 联系开发团队
