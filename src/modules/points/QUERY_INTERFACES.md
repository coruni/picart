# 积分系统查询接口补充

## 新增的查询接口

### 1. 用户任务记录查询

#### 获取我的任务记录
```
GET /points/tasks/my
Authorization: Bearer {token}
```

返回当前用户的所有任务记录，包括：
- 任务进度
- 完成状态
- 奖励领取状态
- 关联的活动信息

#### 获取指定活动的任务进度
```
GET /points/tasks/my/:activityId
Authorization: Bearer {token}
```

返回用户在指定活动中的详细进度信息。

### 2. 管理员查询接口

#### 获取所有用户的积分交易记录
```
GET /points/transactions/all?page=1&limit=10&type=EARN&source=DAILY_LOGIN
Authorization: Bearer {token}
Permissions: points:manage
```

查询参数：
- `page`: 页码（默认1）
- `limit`: 每页数量（默认10）
- `type`: 交易类型（EARN/SPEND）
- `source`: 积分来源

#### 获取积分系统统计数据
```
GET /points/statistics
Authorization: Bearer {token}
Permissions: points:manage
```

返回完整的系统统计信息：
```json
{
  "transactions": {
    "total": 1000,
    "earned": 800,
    "spent": 200
  },
  "points": {
    "totalEarned": 50000,
    "totalSpent": 12000
  },
  "users": {
    "activeUsers": 150
  },
  "activities": {
    "total": 14,
    "active": 12
  },
  "tasks": {
    "totalRecords": 500,
    "completed": 300,
    "claimed": 250,
    "completionRate": "60.00",
    "claimRate": "83.33"
  },
  "bySource": [
    {
      "source": "DAILY_LOGIN",
      "count": 300,
      "total": 3000
    }
  ]
}
```

#### 获取指定用户的积分交易记录
```
GET /points/users/:userId/transactions?page=1&limit=10
Authorization: Bearer {token}
Permissions: points:manage
```

管理员查看任意用户的积分交易记录。

#### 获取指定用户的积分余额
```
GET /points/users/:userId/balance
Authorization: Bearer {token}
Permissions: points:manage
```

管理员查看任意用户的积分余额。

## 完整的接口列表

### 用户接口（需要登录）
- `POST /points/spend` - 消费积分
- `GET /points/balance` - 获取积分余额
- `GET /points/transactions` - 获取我的积分交易记录
- `GET /points/tasks/my` - 获取我的任务记录
- `GET /points/tasks/my/:activityId` - 获取指定活动的任务进度
- `POST /points/activities/:id/claim` - 领取任务奖励

### 公开接口（无需登录）
- `GET /points/activities` - 获取积分活动列表
- `GET /points/activities/:id` - 获取积分活动详情

### 管理员接口（需要 points:manage 权限）
- `POST /points/add` - 增加积分
- `POST /points/activities` - 创建积分活动
- `PATCH /points/activities/:id` - 更新积分活动
- `DELETE /points/activities/:id` - 删除积分活动
- `GET /points/transactions/all` - 获取所有用户的积分交易记录
- `GET /points/statistics` - 获取积分系统统计数据
- `GET /points/users/:userId/transactions` - 获取指定用户的积分交易记录
- `GET /points/users/:userId/balance` - 获取指定用户的积分余额

## 权限说明

- **普通用户**: 可以查看和管理自己的积分、任务记录
- **管理员**: 拥有 `points:manage` 权限，可以：
  - 管理积分活动
  - 手动调整用户积分
  - 查看所有用户的积分数据
  - 查看系统统计信息

## 统计数据说明

### 交易统计
- `total`: 总交易数
- `earned`: 积分获取交易数
- `spent`: 积分消费交易数

### 积分统计
- `totalEarned`: 系统总发放积分
- `totalSpent`: 系统总消费积分

### 用户统计
- `activeUsers`: 有积分交易记录的用户数

### 活动统计
- `total`: 总活动数
- `active`: 启用的活动数

### 任务统计
- `totalRecords`: 总任务记录数
- `completed`: 已完成任务数
- `claimed`: 已领取奖励数
- `completionRate`: 任务完成率
- `claimRate`: 奖励领取率

### 来源统计
按积分来源统计获取的积分数量和次数，帮助分析哪些活动最受欢迎。