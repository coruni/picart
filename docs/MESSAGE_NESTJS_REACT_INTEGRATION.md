# NestJS + React 私信对接文档

## 目标

本文档用于对接当前项目中的私信能力，覆盖：

- NestJS 后端 REST 接口
- NestJS WebSocket 事件
- React 端基础封装
- React 私信列表页 / 会话页接入方式
- 已读与未读处理建议

当前消息模块已支持：

- 私信发送
- 私信会话列表
- 私信历史消息
- WebSocket 实时接收私信
- 私信独立存储在 `private_conversation` / `private_message` 表

当前不包含：

- 群聊
- 撤回消息
- 图片/文件消息专用结构
- 会话置顶/免打扰

## 一、后端能力概览

消息模块路径：

- `src/modules/message/message.controller.ts`
- `src/modules/message/message.service.ts`
- `src/modules/message/message.gateway.ts`

私信相关接口：

- `POST /message/private/:userId`
- `GET /message/private/conversations`
- `GET /message/private/conversations/:userId/messages`
- `POST /message/private/read-batch`
- `POST /message/private/recall/:id`
- `POST /message/private/block/:userId`
- `DELETE /message/private/block/:userId`
- `GET /message/private/blocks`
- `POST /message/:id/read`
- `GET /message/unread/count`

WebSocket 命名空间：

```txt
/ws-message
```

## 二、数据结构说明

### 1. Message 基础结构

后端返回的私信消息对象可按下面结构理解：

```ts
export interface Message {
  id: number;
  senderId: number | null;
  receiverId: number | null;
  content: string;
  type: "private" | "system" | "notification";
  isRead: boolean;
  isBroadcast: boolean;
  title: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  sender?: UserProfile | null;
  receiver?: UserProfile | null;
  articleId?: number | null;
  commentId?: number | null;
  targetId?: number | null;
  targetType?: string | null;
  notificationType?: string | null;
}
```

### 2. UserProfile 建议结构

```ts
export interface UserProfile {
  id: number;
  username: string;
  nickname?: string;
  avatar?: string;
}
```

### 3. 分页结构

```ts
export interface PaginatedList<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
```

### 4. 会话列表结构

```ts
export interface PrivateConversation {
  counterpart: UserProfile | null;
  latestMessage: Message | null;
  unreadCount: number;
}
```

## 三、REST 对接

### 1. 发送私信

```http
POST /message/private/:userId
Authorization: Bearer <token>
Content-Type: application/json
```

请求体：

```json
{
  "content": "你好，想和你聊聊",
  "title": "私信",
  "metadata": {
    "source": "chat"
  }
}
```

React 调用示例：

```ts
export async function sendPrivateMessage(userId: number, payload: {
  content: string;
  title?: string;
  metadata?: Record<string, unknown>;
}) {
  const res = await fetch(`/api/v1/message/private/${userId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error("发送私信失败");
  }

  return res.json();
}
```

### 2. 获取私信会话列表

```http
GET /message/private/conversations?page=1&limit=20
Authorization: Bearer <token>
```

React 调用示例：

```ts
export async function getPrivateConversations(page = 1, limit = 20) {
  const res = await fetch(
    `/api/v1/message/private/conversations?page=${page}&limit=${limit}`,
    {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    },
  );

  if (!res.ok) {
    throw new Error("获取私信会话失败");
  }

  return res.json() as Promise<PaginatedList<PrivateConversation>>;
}
```

### 3. 获取与指定用户的私信历史

```http
GET /message/private/conversations/:userId/messages?page=1&limit=20
Authorization: Bearer <token>
```

React 调用示例：

```ts
export async function getPrivateHistory(
  userId: number,
  page = 1,
  limit = 20,
) {
  const res = await fetch(
    `/api/v1/message/private/conversations/${userId}/messages?page=${page}&limit=${limit}`,
    {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    },
  );

  if (!res.ok) {
    throw new Error("获取私信历史失败");
  }

  return res.json() as Promise<PaginatedList<Message>>;
}
```

### 4. 标记单条消息已读

```http
POST /message/:id/read
Authorization: Bearer <token>
```

```ts
export async function markMessageRead(messageId: number) {
  const res = await fetch(`/api/v1/message/${messageId}/read`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
  });

  if (!res.ok) {
    throw new Error("标记已读失败");
  }

  return res.json();
}
```

### 5. 获取未读总数

```http
GET /message/unread/count
Authorization: Bearer <token>
```

返回示例：

```json
{
  "personal": 3,
  "broadcast": 1,
  "total": 4
}
```

## 四、WebSocket 对接

### 1. 安装依赖

```bash
npm install socket.io-client
```

### 2. 建立连接

```ts
import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function createMessageSocket(token: string) {
  socket = io("/ws-message", {
    transports: ["websocket"],
    auth: {
      token,
    },
  });

  return socket;
}

export function getMessageSocket() {
  return socket;
}
```

如果前后端域名不同，建议使用完整地址：

```ts
io("http://localhost:3000/ws-message", {
  transports: ["websocket"],
  auth: { token },
});
```

### 3. 服务端支持的主要事件

客户端发送：

- `sendMessage`
- `getPrivateConversations`
- `getPrivateHistory`
- `readMessage`
- `getUnreadCount`
- `ping`

服务端返回：

- `connected`
- `error`
- `newMessage`
- `privateMessage`
- `privateConversations`
- `privateHistory`
- `read`
- `unreadCount`
- `pong`

### 4. 发送私信

```ts
socket.emit("sendMessage", {
  content: "你好",
  toUserId: 2,
  type: "private",
});
```

说明：

- `toUserId` 必填
- `type` 建议固定传 `"private"`
- 当前私信发送成功后，发送方和接收方都会收到实时事件

### 5. 拉取会话列表

```ts
socket.emit("getPrivateConversations", {
  page: 1,
  limit: 20,
});
```

监听：

```ts
socket.on("privateConversations", (payload) => {
  console.log("会话列表", payload);
});
```

### 6. 拉取某个用户的私信历史

```ts
socket.emit("getPrivateHistory", {
  userId: 2,
  page: 1,
  limit: 20,
});
```

监听：

```ts
socket.on("privateHistory", (payload) => {
  console.log("私信历史", payload);
});
```

### 7. 监听实时私信

```ts
socket.on("privateMessage", (message: Message) => {
  console.log("收到私信", message);
});

socket.on("newMessage", (message: Message) => {
  console.log("收到新消息", message);
});
```

建议：

- 聊天页面优先监听 `privateMessage`
- 通知中心或全局消息角标可以监听 `newMessage`

## 五、React 推荐封装

### 1. `message-api.ts`

建议把 REST 请求统一放在一个文件中：

```ts
export const messageApi = {
  getPrivateConversations,
  getPrivateHistory,
  sendPrivateMessage,
  markMessageRead,
};
```

### 2. `message-socket.ts`

```ts
import { io, Socket } from "socket.io-client";

class MessageSocketClient {
  private socket: Socket | null = null;

  connect(token: string) {
    if (this.socket?.connected) return this.socket;

    this.socket = io("/ws-message", {
      transports: ["websocket"],
      auth: { token },
    });

    return this.socket;
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }

  get instance() {
    return this.socket;
  }
}

export const messageSocketClient = new MessageSocketClient();
```

### 3. `useMessageSocket.ts`

```ts
import { useEffect, useState } from "react";
import { messageSocketClient } from "./message-socket";

export function useMessageSocket(token?: string) {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token) return;

    const socket = messageSocketClient.connect(token);

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, [token]);

  return {
    socket: messageSocketClient.instance,
    connected,
  };
}
```

## 六、React 页面接入示例

### 1. 私信会话列表页

```tsx
import { useEffect, useState } from "react";
import { getPrivateConversations } from "./message-api";

export function ConversationListPage() {
  const [items, setItems] = useState<PrivateConversation[]>([]);

  useEffect(() => {
    getPrivateConversations().then((res) => {
      setItems(res.data);
    });
  }, []);

  return (
    <div>
      {items.map((item) => (
        <div key={item.counterpart?.id ?? item.latestMessage?.id}>
          <div>{item.counterpart?.nickname || item.counterpart?.username}</div>
          <div>{item.latestMessage?.content}</div>
          <div>未读: {item.unreadCount}</div>
        </div>
      ))}
    </div>
  );
}
```

### 2. 私信聊天页

```tsx
import { useEffect, useState } from "react";
import { getPrivateHistory, sendPrivateMessage } from "./message-api";
import { useMessageSocket } from "./useMessageSocket";

export function ChatPage({
  token,
  targetUserId,
}: {
  token: string;
  targetUserId: number;
}) {
  const { socket } = useMessageSocket(token);
  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState("");

  useEffect(() => {
    getPrivateHistory(targetUserId).then((res) => {
      setMessages(res.data.slice().reverse());
    });
  }, [targetUserId]);

  useEffect(() => {
    if (!socket) return;

    const onPrivateMessage = (message: Message) => {
      const matched =
        message.senderId === targetUserId || message.receiverId === targetUserId;

      if (matched) {
        setMessages((prev) => [...prev, message]);
      }
    };

    socket.on("privateMessage", onPrivateMessage);
    return () => {
      socket.off("privateMessage", onPrivateMessage);
    };
  }, [socket, targetUserId]);

  async function handleSend() {
    if (!content.trim()) return;

    await sendPrivateMessage(targetUserId, { content });
    setContent("");
  }

  return (
    <div>
      <div>
        {messages.map((msg) => (
          <div key={msg.id}>{msg.content}</div>
        ))}
      </div>
      <input value={content} onChange={(e) => setContent(e.target.value)} />
      <button onClick={handleSend}>发送</button>
    </div>
  );
}
```

## 七、推荐联调方式

### 方案 A：REST 为主，WebSocket 为辅

适合先快速稳定上线：

- 首次进入页面时用 REST 拉取会话列表和历史消息
- 发消息先调 REST
- 再用 WebSocket 监听实时新增消息

优点：

- 调试简单
- 错误链路清晰
- 容易排查鉴权问题

### 方案 B：聊天页用 WebSocket 事件拉历史

适合已经统一 socket 通道的前端项目：

- 页面进入后用 `getPrivateHistory`
- 新消息继续用 `privateMessage`

优点：

- 协议一致
- 更接近 IM 场景

## 八、已读处理建议

当前后端支持单条已读：

```ts
socket.emit("readMessage", { messageId: 123 });
```

或者：

```ts
await markMessageRead(123);
```

推荐策略：

- 聊天页打开后，把当前可见且 `receiverId === 当前用户` 的消息逐条标记已读
- 会话列表页只显示 `unreadCount`
- 收到 `privateMessage` 且当前正处于该会话时，前端可立即调用已读接口

## 九、常见问题

### 1. 为什么我连接上了，但收不到私信？

先检查：

- token 是否有效
- socket 是否连接到了 `/ws-message`
- 是否监听了 `privateMessage`
- 发送时是否传了 `toUserId`
- 发送时 `type` 是否为 `"private"`

### 2. 为什么聊天页刷新后顺序不对？

后端私信历史按 `createdAt DESC` 返回。  
如果前端聊天窗口需要从旧到新展示，需要在 React 中手动反转：

```ts
setMessages(res.data.slice().reverse());
```

### 3. 为什么会话列表里有未读，但聊天页里消息显示已读不及时？

这是因为当前未读统计和消息列表刷新是两个动作。  
前端在调用 `markMessageRead` 后，建议同步：

- 更新本地消息 `isRead`
- 重新拉一次会话列表或未读总数

## 十、推荐目录结构

React 端建议拆成下面这样：

```txt
src/
  modules/
    message/
      api.ts
      socket.ts
      use-message-socket.ts
      types.ts
      conversation-list.tsx
      chat-page.tsx
```

## 十一、后续可扩展方向

如果后面继续增强私信，建议优先做：

1. 会话分页游标，而不是简单 page/limit
2. 已读回执批量接口
3. 撤回消息
4. 图片、文件、卡片消息结构
5. 拉黑校验
6. 会话排序实时更新
