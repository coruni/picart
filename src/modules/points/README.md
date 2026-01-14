# 积分模块 (Points Module)

完整的积分系统，支持积分获取、消费、规则管理和任务系统。

## 功能特性

### 1. 积分交易
- ✅ 增加积分
- ✅ 消费积分
- ✅ 积分交易记录查询
- ✅ 积分统计（总获得、总消费、即将过期）
- ✅ 积分过期管理

### 2. 积分规则
- ✅ 创建/更新/删除规则
- ✅ 每日限制次数
- ✅ 总限制次数
- ✅ 积分有效期设置
- ✅ 规则启用/禁用

### 3. 积分任务
- ✅ 每日/每周/每月/一次性任务
- ✅ 任务进度跟踪
- ✅ 任务完成检测
- ✅ 奖励领取

## 数据库表结构

### points_transaction (积分交易记录)
- 记录所有积分变动
- 支持多种交易类型：EARN, SPEND, ADMIN_ADJUST, EXPIRE, REFUND
- 关联业务类型和ID
- 积分过期时间

### points_rule (积分规则)
- 定义积分获取规则
- 每日/总次数限制
- 积分有效期

### points_task (积分任务)
- 任务定义
- 任务类型：DAILY, WEEKLY, MONTHLY, ONCE
- 奖励积分设置

### points_task_record (任务完成记录)
- 用户任务进度
- 完成状态
- 奖励领取状态

## API 接口

### 用户积分操作

#### POST /points/add
增加积分
```json
{
  "amount": 100,
  "source": "DAILY_LOGIN",
  "description": "每日登录奖励",
  "validDays": 365
}
```

#### POST /points/spend
消费积分
```json
{
  "amount": 50,
  "source": "BUY_DECORATION",
  "description": "购买装饰品"
}
```

#### GET /points/transactions
获取积分交易记录
- Query: page, limit, type, source

#### GET /points/stats
获取积分统计

### 积分规则管理 (需要 points:manage 权限)

#### POST /points/rules
创建积分规则

#### GET /points/rules
获取所有规则

#### GET /points/rules/:id
获取规则详情

#### PATCH /points/rules/:id
更新规则

#### DELETE /points/rules/:id
删除规则

### 积分任务管理

#### POST /points/tasks (需要 points:manage 权限)
创建任务

#### GET /points/tasks
获取所有任务（带用户进度）

#### GET /points/tasks/:id
获取任务详情

#### PATCH /points/tasks/:id (需要 points:manage 权限)
更新任务

#### DELETE /points/tasks/:id (需要 points:manage 权限)
删除任务

#### POST /points/tasks/:id/claim
领取任务奖励

## 使用示例

### 1. 根据规则增加积分

```typescript
// 在其他模块中注入 PointsService
constructor(private pointsService: PointsService) {}

// 用户登录时
await this.pointsService.addPointsByRule(userId, 'DAILY_LOGIN');

// 发布文章时
await this.pointsService.addPointsByRule(
  userId, 
  'PUBLISH_ARTICLE',
  'ARTICLE',
  articleId
);
```

### 2. 更新任务进度

```typescript
// 用户评论时
await this.pointsService.updateTaskProgress(
  userId,
  'COMMENT_10_TIMES',
  1  // 增加1次进度
);
```

### 3. 消费积分

```typescript
// 购买装饰品时
await this.pointsService.spendPoints(userId, {
  amount: 100,
  source: 'BUY_DECORATION',
  description: '购买装饰品',
  relatedType: 'DECORATION',
  relatedId: decorationId,
});
```

## 初始化数据

参考 `points-rules.seed.ts` 文件中的种子数据，包含：

### 预设规则
- DAILY_LOGIN: 每日登录 (10积分)
- PUBLISH_ARTICLE: 发布文章 (50积分)
- COMMENT_ARTICLE: 评论文章 (5积分)
- LIKE_ARTICLE: 点赞文章 (2积分)
- SHARE_ARTICLE: 分享文章 (10积分)
- INVITE_USER: 邀请用户 (100积分)
- COMPLETE_PROFILE: 完善资料 (50积分)

### 预设任务
- DAILY_LOGIN_TASK: 每日签到
- PUBLISH_3_ARTICLES: 发布3篇文章
- COMMENT_10_TIMES: 评论10次
- INVITE_5_USERS: 邀请5位好友

## 国际化标识

### 错误消息
- `response.error.userNotExist` - 用户不存在
- `response.error.insufficientPoints` - 积分不足
- `response.error.pointsRuleNotFound` - 积分规则不存在
- `response.error.pointsRuleCodeExists` - 积分规则代码已存在
- `response.error.pointsDailyLimitReached` - 达到每日限制
- `response.error.pointsTotalLimitReached` - 达到总限制
- `response.error.pointsTaskNotFound` - 积分任务不存在
- `response.error.pointsTaskCodeExists` - 积分任务代码已存在
- `response.error.pointsTaskRecordNotFound` - 任务记录不存在
- `response.error.pointsTaskNotCompleted` - 任务未完成
- `response.error.pointsTaskAlreadyRewarded` - 奖励已领取

### 成功消息
- `response.success.pointsAdd` - 积分增加成功
- `response.success.pointsSpend` - 积分消费成功
- `response.success.pointsRuleCreate` - 积分规则创建成功
- `response.success.pointsRuleUpdate` - 积分规则更新成功
- `response.success.pointsRuleDelete` - 积分规则删除成功
- `response.success.pointsTaskCreate` - 积分任务创建成功
- `response.success.pointsTaskUpdate` - 积分任务更新成功
- `response.success.pointsTaskDelete` - 积分任务删除成功
- `response.success.pointsTaskRewardClaimed` - 任务奖励领取成功

## 注意事项

1. 积分交易是原子操作，确保数据一致性
2. 积分规则的限制检查在增加积分前执行
3. 任务进度更新是幂等的，可以安全重试
4. 过期积分需要定时任务清理（待实现）
5. 建议在关键业务操作中使用事务包裹积分操作
