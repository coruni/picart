# 签到功能说明

## 功能概述

用户签到系统支持自动签到和手动签到两种方式，记录用户的签到历史和连续签到天数。

## 签到方式

### 1. 自动签到
- **触发时机**: 每次调用 `GET /user/profile` 接口时自动检查并签到
- **特点**: 
  - 用户无感知，每天首次获取个人信息时自动完成签到
  - 适合每次打开应用都会调用 profile 接口的场景
  - 签到失败不影响获取用户信息

### 2. 手动签到
- **接口**: `POST /user/sign-in`
- **特点**:
  - 用户主动触发签到
  - 可以配合签到页面使用
  - 重复签到会返回错误提示

## API 接口

### 手动签到
```
POST /user/sign-in
Authorization: Bearer {token}
```

响应示例：
```json
{
  "message": "签到成功",
  "consecutiveDays": 7,
  "isAuto": false
}
```

### 获取签到记录
```
GET /user/sign-in/records?days=30
Authorization: Bearer {token}
```

查询参数：
- `days`: 查询最近多少天的记录（默认30天）

响应示例：
```json
[
  {
    "id": 1,
    "userId": 1,
    "signInDate": "2025-01-15",
    "consecutiveDays": 7,
    "isAuto": true,
    "createdAt": "2025-01-15T08:30:00Z"
  },
  {
    "id": 2,
    "userId": 1,
    "signInDate": "2025-01-14",
    "consecutiveDays": 6,
    "isAuto": false,
    "createdAt": "2025-01-14T09:15:00Z"
  }
]
```

### 获取签到统计
```
GET /user/sign-in/stats
Authorization: Bearer {token}
```

响应示例：
```json
{
  "hasSignedToday": true,
  "totalDays": 30,
  "consecutiveDays": 7,
  "todaySignIn": {
    "id": 1,
    "userId": 1,
    "signInDate": "2025-01-15",
    "consecutiveDays": 7,
    "isAuto": true,
    "createdAt": "2025-01-15T08:30:00Z"
  }
}
```

## 数据库设计

### UserSignIn 实体字段

| 字段名 | 类型 | 长度 | 默认值 | 可空 | 说明 |
|--------|------|------|--------|------|------|
| id | int | - | AUTO | N | 签到记录ID（主键） |
| userId | int | - | - | N | 用户ID（外键） |
| signInDate | date | - | - | N | 签到日期 |
| consecutiveDays | int | - | 1 | N | 连续签到天数 |
| isAuto | boolean | - | false | N | 是否为自动签到 |
| createdAt | datetime | - | NOW | N | 创建时间 |

**关联关系：**
- 多对一：user (用户)

## 签到事件

签到成功后会触发 `user.dailyLogin` 事件，其他模块可以监听此事件：

### 当前监听器
1. **LevelEventService** - 每日登录获得经验值（5经验）
2. **PointsEventService** - 每日登录获得积分
3. **DecorationService** - 更新装饰品活动的签到进度

### 事件数据
```typescript
{
  userId: number
}
```

## 连续签到逻辑

- 如果昨天有签到记录，今天签到时 `consecutiveDays` = 昨天的天数 + 1
- 如果昨天没有签到记录（中断了），今天签到时 `consecutiveDays` = 1
- 每天只能签到一次，重复签到会返回错误

## 使用建议

1. **推荐使用自动签到**：用户体验更好，无需额外操作
2. **可选手动签到**：如果需要签到页面或签到仪式感，可以提供手动签到按钮
3. **签到奖励**：可以根据 `consecutiveDays` 设置不同的奖励等级
4. **签到提醒**：可以在前端检查 `hasSignedToday`，如果为 false 则提示用户签到

## 扩展功能建议

1. **签到奖励配置**：根据连续签到天数给予不同奖励
2. **补签功能**：允许用户消耗道具补签漏掉的天数
3. **签到排行榜**：展示连续签到天数最多的用户
4. **签到日历**：可视化展示用户的签到历史
