# 积分任务系统文档

## 概述

PicArt 积分系统采用事件驱动架构，通过监听业务事件自动发放积分。系统支持即时奖励、周期性任务和一次性任务三种类型。

## 目录

- [事件处理器](#事件处理器)
- [活动类型](#活动类型)
- [积分活动配置](#积分活动配置)
- [核心服务方法](#核心服务方法)
- [限流机制](#限流机制)
- [实体关系](#实体关系)
- [使用示例](#使用示例)

---

## 事件处理器

位于 `src/modules/points/points-event.service.ts`

| 事件名                    | 处理器                         | 触发场景       | 对应活动代码               |
| ------------------------- | ------------------------------ | -------------- | -------------------------- |
| `article.created`         | `handleArticleCreated`         | 发布文章       | `PUBLISH_ARTICLE`          |
| `article.liked`           | `handleArticleLiked`           | 点赞文章       | `LIKE_ARTICLE`             |
| `comment.created`         | `handleCommentCreated`         | 发表评论       | `PUBLISH_COMMENT`          |
| `comment.liked`           | `handleCommentLiked`           | 点赞评论       | `LIKE_COMMENT`             |
| `user.dailyLogin`         | `handleDailyLogin`             | 每日登录       | `DAILY_LOGIN`              |
| `article.receivedLike`    | `handleArticleReceivedLike`    | 文章被他人点赞 | `ARTICLE_RECEIVED_LIKE`    |
| `comment.receivedLike`    | `handleCommentReceivedLike`    | 评论被他人点赞 | `COMMENT_RECEIVED_LIKE`    |
| `article.receivedComment` | `handleArticleReceivedComment` | 文章被他人评论 | `ARTICLE_RECEIVED_COMMENT` |
| `decoration.purchased`    | `handleDecorationPurchased`    | 购买装饰品     | 消费积分                   |
| `task.progress`           | `handleTaskProgress`           | 更新任务进度   | 周期性任务                 |

---

## 活动类型

### INSTANT（即时奖励）

触发后立即获得积分，无需手动领取。

### ONCE（一次性）

终身只能完成一次的任务，如"完善资料"。

### DAILY / WEEKLY / MONTHLY（周期性任务）

需要在周期内累计完成指定次数后手动领取奖励。

| 类型      | 说明                   |
| --------- | ---------------------- |
| `DAILY`   | 每日任务，进度每日重置 |
| `WEEKLY`  | 每周任务，进度每周重置 |
| `MONTHLY` | 每月任务，进度每月重置 |

---

## 积分活动配置

位于 `src/modules/points/points-activities.seed.ts`

### 即时奖励 (INSTANT)

| 代码                       | 名称       | 积分 | 日限 | 总限 | 有效期 |
| -------------------------- | ---------- | ---- | ---- | ---- | ------ |
| `DAILY_LOGIN`              | 每日登录   | 10   | 1    | 0    | 365天  |
| `PUBLISH_ARTICLE`          | 发布文章   | 50   | 5    | 0    | 永久   |
| `PUBLISH_COMMENT`          | 发表评论   | 5    | 10   | 0    | 永久   |
| `LIKE_COMMENT`             | 点赞评论   | 1    | 20   | 0    | 永久   |
| `LIKE_ARTICLE`             | 点赞文章   | 2    | 20   | 0    | 永久   |
| `ARTICLE_RECEIVED_LIKE`    | 文章被点赞 | 1    | 0    | 0    | 永久   |
| `ARTICLE_RECEIVED_COMMENT` | 文章被评论 | 3    | 0    | 0    | 永久   |
| `COMMENT_RECEIVED_LIKE`    | 评论被点赞 | 1    | 0    | 0    | 永久   |
| `SHARE_ARTICLE`            | 分享文章   | 10   | 5    | 0    | 永久   |
| `INVITE_USER`              | 邀请用户   | 100  | 0    | 0    | 永久   |
| `COMPLETE_PROFILE`         | 完善资料   | 50   | 0    | 1    | 永久   |

### 周期性任务 (WEEKLY)

| 代码                        | 名称            | 积分 | 目标次数 | 类型   |
| --------------------------- | --------------- | ---- | -------- | ------ |
| `PUBLISH_3_ARTICLES_WEEKLY` | 每周发布3篇文章 | 200  | 3        | WEEKLY |
| `COMMENT_10_TIMES_WEEKLY`   | 每周评论10次    | 100  | 10       | WEEKLY |

### 一次性任务 (ONCE)

| 代码                         | 名称     | 积分 | 目标次数 |
| ---------------------------- | -------- | ---- | -------- |
| `INVITE_5_USERS_ACHIEVEMENT` | 邀请达人 | 500  | 5        |

---

## 核心服务方法

位于 `src/modules/points/points.service.ts`

### 通过活动规则增加积分

```typescript
async addPointsByRule(
  userId: number,
  activityCode: string,
  relatedType?: string,
  relatedId?: number
): Promise<PointsResult>
```

自动检查活动限制条件（每日/总限制），适用于即时奖励场景。

### 直接增加积分

```typescript
async addPoints(
  userId: number,
  addPointsDto: AddPointsDto
): Promise<PointsResult>

interface AddPointsDto {
  amount: number;        // 积分数量
  source: string;        // 来源代码
  description: string;   // 描述
  relatedType?: string;  // 关联类型
  relatedId?: number;    // 关联ID
  validDays?: number;    // 有效期天数（0=永久）
}
```

### 消费积分

```typescript
async spendPoints(
  userId: number,
  spendPointsDto: SpendPointsDto
): Promise<PointsResult>

interface SpendPointsDto {
  amount: number;        // 消费积分
  source: string;        // 消费来源
  description: string;   // 描述
  relatedType?: string;  // 关联类型
  relatedId?: number;    // 关联ID
}
```

### 更新任务进度

```typescript
async updateTaskProgress(
  userId: number,
  activityCode: string,
  increment: number = 1
): Promise<TaskProgressResult>
```

适用于周期性任务，自动累加进度并判断是否完成。

### 领取任务奖励

```typescript
async claimTaskReward(
  userId: number,
  activityId: number
): Promise<RewardResult>
```

用户完成周期性任务后，调用此接口领取积分奖励。

---

## 限流机制

### 每日限制 (dailyLimit)

每天最多获得该积分的次数。`0` 表示不限制。

```typescript
// 检查今日已触发次数
count >= activity.dailyLimit ? throw Error : continue
```

### 总限制 (totalLimit)

终身最多获得该积分的次数。`0` 表示不限制。

```typescript
// 检查累计已触发次数
count >= activity.totalLimit ? throw Error : continue
```

### 积分有效期 (validDays)

积分有效期天数，`0` 表示永久有效。

```typescript
expiredAt = validDays > 0 ? new Date() + validDays : null;
```

---

## 实体关系

```
┌─────────────────┐
│  PointsActivity │  积分活动定义
│  (活动配置)      │
└────────┬────────┘
         │
         │ 1:N
         ▼
┌─────────────────┐
│PointsTaskRecord │  任务进度记录（仅周期性任务）
│  (任务进度)      │
└────────┬────────┘
         │
         │ 1:N
         ▼
┌─────────────────┐
│PointsTransaction│  积分交易记录
│  (交易流水)      │
└────────┬────────┘
         │
         │ 1:1
         ▼
┌─────────────────┐
│      User       │  用户积分余额
│   (用户表)       │
└─────────────────┘
```

---

## 使用示例

### 1. 触发即时积分奖励

```typescript
// 在文章服务中发布事件
this.eventEmitter.emit("article.created", {
  userId: 123,
  articleId: 456,
});

// PointsEventService 自动处理
// 给用户123增加50积分（PUBLISH_ARTICLE）
```

### 2. 更新周期性任务进度

```typescript
// 发布文章时同时触发周任务进度
this.eventEmitter.emit("task.progress", {
  userId: 123,
  taskCode: "PUBLISH_3_ARTICLES_WEEKLY",
  increment: 1,
});
```

### 3. 领取任务奖励

```typescript
// 用户手动领取奖励
await this.pointsService.claimTaskReward(userId, activityId);
```

### 4. 消费积分

```typescript
// 购买装饰品时扣除积分
await this.pointsService.spendPoints(userId, {
  amount: 100,
  source: "BUY_DECORATION",
  description: "购买装饰品 #123",
  relatedType: "DECORATION",
  relatedId: 123,
});
```

---

## 数据库表结构

### points_activity（积分活动表）

| 字段         | 类型    | 说明                              |
| ------------ | ------- | --------------------------------- |
| id           | int     | 主键                              |
| code         | varchar | 活动代码（唯一）                  |
| name         | varchar | 活动名称                          |
| description  | text    | 活动描述                          |
| type         | enum    | INSTANT/DAILY/WEEKLY/MONTHLY/ONCE |
| rewardPoints | int     | 奖励积分                          |
| targetCount  | int     | 目标次数                          |
| dailyLimit   | int     | 每日限制（0=不限制）              |
| totalLimit   | int     | 总限制（0=不限制）                |
| validDays    | int     | 有效期天数（0=永久）              |
| icon         | varchar | 图标                              |
| link         | varchar | 跳转链接                          |
| isActive     | boolean | 是否启用                          |
| sort         | int     | 排序                              |

### points_task_record（任务记录表）

| 字段         | 类型     | 说明       |
| ------------ | -------- | ---------- |
| id           | int      | 主键       |
| userId       | int      | 用户ID     |
| taskId       | int      | 任务ID     |
| currentCount | int      | 当前完成数 |
| targetCount  | int      | 目标数     |
| isCompleted  | boolean  | 是否完成   |
| completedAt  | datetime | 完成时间   |
| rewardPoints | int      | 奖励积分   |
| isRewarded   | boolean  | 是否已领取 |
| rewardedAt   | datetime | 领取时间   |

### points_transaction（积分交易表）

| 字段        | 类型     | 说明                                  |
| ----------- | -------- | ------------------------------------- |
| id          | int      | 主键                                  |
| userId      | int      | 用户ID                                |
| amount      | int      | 变动数量（正增负减）                  |
| balance     | int      | 变动后余额                            |
| type        | enum     | EARN/SPEND/ADMIN_ADJUST/EXPIRE/REFUND |
| source      | varchar  | 来源代码                              |
| relatedType | varchar  | 关联类型                              |
| relatedId   | int      | 关联ID                                |
| description | text     | 描述                                  |
| expiredAt   | datetime | 过期时间                              |
| createdAt   | datetime | 创建时间                              |
