# 消息统计功能说明

## 功能概述

信息模块提供了两个统计相关的功能，它们有不同的用途和返回数据：

## 1. 获取未读消息数量 (`getUnreadCount`)

### 用途
专门用于获取用户未读消息的数量，通常用于显示消息提醒徽章。

### API端点
- **HTTP**: `GET /message/unread/count`
- **WebSocket**: `getUnreadCount`

### 返回数据
```json
{
  "success": true,
  "data": {
    "personal": 5,      // 个人未读消息数量
    "broadcast": 3,     // 广播未读消息数量
    "total": 8          // 总未读消息数量
  }
}
```

### 使用场景
- 消息列表页面显示未读数量
- 导航栏显示消息提醒徽章
- 实时更新未读消息状态

## 2. 获取消息统计信息 (`getMessageStats`)

### 用途
提供完整的消息统计信息，包括按类型统计、未读统计和总体统计。

### API端点
- **HTTP**: `GET /message/stats`
- **WebSocket**: `getMessageStats`

### 返回数据
```json
{
  "success": true,
  "data": {
    // 按类型统计
    "typeStats": [
      { "type": "private", "count": 15 },
      { "type": "system", "count": 8 },
      { "type": "notification", "count": 12 }
    ],
    // 未读消息统计
    "unread": {
      "personal": 5,
      "broadcast": 3,
      "total": 8
    },
    // 总体统计
    "total": {
      "messages": 35,    // 总消息数
      "read": 27,        // 已读消息数
      "unread": 8        // 未读消息数
    }
  }
}
```

### 使用场景
- 消息管理页面显示完整统计
- 数据分析面板
- 用户消息概览

## 功能对比

| 功能 | 用途 | 数据详细程度 | 性能 | 使用频率 |
|------|------|-------------|------|----------|
| `getUnreadCount` | 未读消息提醒 | 简单 | 高 | 高频 |
| `getMessageStats` | 完整统计信息 | 详细 | 中 | 中频 |

## 优化建议

### 1. 缓存策略
- `getUnreadCount`: 可以缓存5-10秒，因为主要用于UI显示
- `getMessageStats`: 可以缓存30-60秒，因为数据变化不频繁

### 2. 使用建议
- **前端应用**: 优先使用 `getUnreadCount` 进行实时更新
- **管理后台**: 使用 `getMessageStats` 获取完整统计信息
- **移动端**: 根据网络状况选择，网络好时使用 `getMessageStats`，网络差时使用 `getUnreadCount`

### 3. 性能优化
```typescript
// 前端缓存示例
class MessageStatsCache {
  private cache = new Map();
  private readonly TTL = 30000; // 30秒

  async getUnreadCount(userId: number) {
    const key = `unread_${userId}`;
    const cached = this.cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < 5000) {
      return cached.data;
    }
    
    const data = await api.getUnreadCount();
    this.cache.set(key, { data, timestamp: Date.now() });
    return data;
  }

  async getMessageStats(userId: number) {
    const key = `stats_${userId}`;
    const cached = this.cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < this.TTL) {
      return cached.data;
    }
    
    const data = await api.getMessageStats();
    this.cache.set(key, { data, timestamp: Date.now() });
    return data;
  }
}
```

## 错误处理

两个接口都使用统一的错误处理机制：

```json
{
  "statusCode": 500,
  "message": "获取统计信息失败",
  "error": "Internal Server Error"
}
```

## 权限控制

- 两个接口都需要用户登录
- 用户只能查看自己的消息统计
- 广播消息统计包含所有用户可见的广播消息
