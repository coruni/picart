# 成就系统文档

## 概述

PicArt 成就系统基于事件驱动架构，用户完成特定行为后自动解锁成就。成就分为多种类型，支持计数型、阈值型、连续型等多种完成条件。

## 目录

- [Condition 格式](#condition-格式)
- [成就类型](#成就类型)
- [稀有度](#稀有度)
- [事件处理器](#事件处理器)
- [成就配置示例](#成就配置示例)
- [核心服务方法](#核心服务方法)
- [奖励机制](#奖励机制)
- [数据库表结构](#数据库表结构)

---

## Condition 格式

Condition 是 JSON 格式，定义成就的完成条件。支持以下类型：

### 1. count（计数型）

累计发生指定次数后完成。

```json
{
  "type": "count",
  "target": 10,
  "event": "article.created"
}
```

| 字段     | 类型   | 说明                       |
| -------- | ------ | -------------------------- |
| `type`   | string | 条件类型，固定为 `"count"` |
| `target` | number | 目标次数，达到即完成       |
| `event`  | string | 监听的事件名               |

**适用场景**：发布文章、发表评论、获得点赞等。

---

### 2. threshold（阈值型）

达到某个数值阈值后完成。

```json
{
  "type": "threshold",
  "target": 10,
  "event": "user.levelUp"
}
```

| 字段     | 类型   | 说明                           |
| -------- | ------ | ------------------------------ |
| `type`   | string | 条件类型，固定为 `"threshold"` |
| `target` | number | 目标阈值                       |
| `event`  | string | 监听的事件名                   |

**适用场景**：达到指定等级、粉丝数达到指定数量等。

---

### 3. consecutive（连续型）

连续发生指定次数后完成。

```json
{
  "type": "consecutive",
  "target": 7,
  "event": "user.dailyLogin"
}
```

| 字段     | 类型   | 说明                             |
| -------- | ------ | -------------------------------- |
| `type`   | string | 条件类型，固定为 `"consecutive"` |
| `target` | number | 连续目标天数                     |
| `event`  | string | 监听的事件名                     |

**适用场景**：连续登录7天、连续签到30天等。

---

### 4. once（一次性）

只需触发一次即完成。

```json
{
  "type": "once",
  "target": 1,
  "event": "user.profileCompleted"
}
```

| 字段     | 类型   | 说明                      |
| -------- | ------ | ------------------------- |
| `type`   | string | 条件类型，固定为 `"once"` |
| `target` | number | 固定为 `1`                |
| `event`  | string | 监听的事件名              |

**适用场景**：完善资料、首次购买会员等。

---

### 5. custom（自定义）

复杂条件，通过自定义逻辑判断。

```json
{
  "type": "custom",
  "target": 1,
  "event": "special.event",
  "extra": {
    "requirement": "specific_logic"
  }
}
```

| 字段     | 类型   | 说明                        |
| -------- | ------ | --------------------------- |
| `type`   | string | 条件类型，固定为 `"custom"` |
| `target` | number | 目标值                      |
| `event`  | string | 监听的事件名                |
| `extra`  | object | 自定义扩展字段              |

---

## 成就类型

| 类型      | 说明         | 典型示例           |
| --------- | ------------ | ------------------ |
| `ARTICLE` | 文章相关成就 | 发布文章、获得点赞 |
| `COMMENT` | 评论相关成就 | 发表评论、评论被赞 |
| `SOCIAL`  | 社交相关成就 | 关注用户、获得粉丝 |
| `LEVEL`   | 等级相关成就 | 达到指定等级       |
| `SPECIAL` | 特殊成就     | 连续登录、成为会员 |

---

## 稀有度

| 稀有度      | 标识 | 说明                 |
| ----------- | ---- | -------------------- |
| `COMMON`    | 普通 | 容易获得的常规成就   |
| `RARE`      | 稀有 | 需要一定努力才能获得 |
| `EPIC`      | 史诗 | 较难获得的成就       |
| `LEGENDARY` | 传说 | 极难获得的顶级成就   |

---

## 事件处理器

位于 `src/modules/achievement/achievement-event.service.ts`

| 事件名                  | 处理器                      | 更新成就                                           |
| ----------------------- | --------------------------- | -------------------------------------------------- |
| `article.created`       | `handleArticleCreated`      | FIRST_ARTICLE, ARTICLE_10, ARTICLE_50, ARTICLE_100 |
| `article.receivedLike`  | `handleArticleReceivedLike` | FIRST_LIKE, LIKE_100, LIKE_1000                    |
| `comment.created`       | `handleCommentCreated`      | FIRST_COMMENT, COMMENT_100                         |
| `user.followed`         | `handleUserFollowed`        | FIRST_FOLLOW, FOLLOW_10                            |
| `user.receivedFollow`   | `handleUserReceivedFollow`  | FIRST_FOLLOWER, FOLLOWER_100, FOLLOWER_1000        |
| `user.dailyLogin`       | `handleDailyLogin`          | LOGIN_7_DAYS, LOGIN_30_DAYS                        |
| `user.levelUp`          | `handleUserLevelUp`         | LEVEL_10, LEVEL_30, LEVEL_50                       |
| `membership.purchased`  | `handleMembershipPurchased` | BECOME_MEMBER                                      |
| `user.profileCompleted` | `handleProfileCompleted`    | PROFILE_COMPLETED                                  |

---

## 成就配置示例

位于 `src/modules/achievement/achievement.seed.ts`

### 文章相关成就

```typescript
{
  code: "FIRST_ARTICLE",
  name: "初出茅庐",
  description: "发布第一篇文章",
  icon: "",
  type: "ARTICLE",
  rarity: "COMMON",
  condition: { type: "count", target: 1, event: "article.created" },
  rewardPoints: 10,
  rewardExp: 50,
  hidden: false,
  sort: 1,
}
```

### 点赞相关成就

```typescript
{
  code: "LIKE_1000",
  name: "万众瞩目",
  description: "文章累计获得1000个点赞",
  icon: "",
  type: "ARTICLE",
  rarity: "EPIC",
  condition: { type: "count", target: 1000, event: "article.receivedLike" },
  rewardPoints: 500,
  rewardExp: 2000,
  hidden: false,
  sort: 12,
}
```

### 连续登录成就

```typescript
{
  code: "LOGIN_7_DAYS",
  name: "坚持不懈",
  description: "连续登录7天",
  icon: "",
  type: "SPECIAL",
  rarity: "COMMON",
  condition: { type: "consecutive", target: 7, event: "user.dailyLogin" },
  rewardPoints: 50,
  rewardExp: 200,
  hidden: false,
  sort: 50,
}
```

### 等级成就

```typescript
{
  code: "LEVEL_50",
  name: "炉火纯青",
  description: "达到50级",
  icon: "",
  type: "LEVEL",
  rarity: "EPIC",
  condition: { type: "threshold", target: 50, event: "user.levelUp" },
  rewardPoints: 500,
  rewardExp: 0,
  hidden: false,
  sort: 42,
}
```

---

## 核心服务方法

位于 `src/modules/achievement/achievement.service.ts`

### 更新成就进度

```typescript
async updateProgress(
  userId: number,
  achievementCode: string,
  increment: number = 1
): Promise<void>
```

累加用户成就进度，自动判断是否完成。

### 领取成就奖励

```typescript
async claimReward(
  userId: number,
  achievementId: number
): Promise<RewardResult>
```

完成成就后领取积分、经验、装饰品奖励。

### 批量领取奖励

```typescript
async claimAllRewards(userId: number): Promise<BatchClaimResult>
```

一键领取所有已完成但未领取的成就奖励。

### 获取用户成就统计

```typescript
async getUserStats(userId: number): Promise<UserStats>
```

返回：

- total: 总成就数
- completed: 已完成数
- claimed: 已领取奖励数
- completionRate: 完成率

---

## 奖励机制

成就完成后自动发放以下奖励：

### 1. 积分奖励

```typescript
await this.pointsService.addPoints(userId, {
  amount: achievement.rewardPoints,
  source: "ACHIEVEMENT",
  description: `完成成就：${achievement.name}`,
});
```

### 2. 经验奖励

```typescript
this.eventEmitter.emit("user.gainExp", {
  userId,
  exp: achievement.rewardExp,
  reason: `完成成就：${achievement.name}`,
});
```

### 3. 装饰品奖励

成就完成后自动创建/关联装饰品勋章：

```typescript
// 创建成就勋章装饰品
{
  name: achievement.name,
  type: "ACHIEVEMENT_BADGE",
  description: achievement.description,
  imageUrl: achievement.icon,
  rarity: achievement.rarity,
  obtainMethod: "ACHIEVEMENT",
  achievementId: achievement.id
}
```

---

## 数据库表结构

### achievement（成就表）

| 字段               | 类型    | 说明                                 |
| ------------------ | ------- | ------------------------------------ |
| id                 | int     | 主键                                 |
| code               | varchar | 成就代码（唯一）                     |
| name               | varchar | 成就名称                             |
| description        | text    | 成就描述                             |
| icon               | varchar | 图标URL                              |
| type               | enum    | ARTICLE/COMMENT/SOCIAL/LEVEL/SPECIAL |
| rarity             | enum    | COMMON/RARE/EPIC/LEGENDARY           |
| condition          | json    | 完成条件（JSON格式）                 |
| rewardPoints       | int     | 奖励积分                             |
| rewardExp          | int     | 奖励经验                             |
| rewardDecorationId | int     | 奖励装饰品ID                         |
| hidden             | boolean | 是否隐藏（未解锁前不显示）           |
| sort               | int     | 排序                                 |
| enabled            | boolean | 是否启用                             |

### user_achievement（用户成就表）

| 字段          | 类型     | 说明           |
| ------------- | -------- | -------------- |
| id            | int      | 主键           |
| userId        | int      | 用户ID         |
| achievementId | int      | 成就ID         |
| progress      | int      | 当前进度       |
| completed     | boolean  | 是否完成       |
| completedAt   | datetime | 完成时间       |
| claimed       | boolean  | 是否已领取奖励 |
| claimedAt     | datetime | 领取时间       |

---

## 完整配置示例

```typescript
export const INITIAL_ACHIEVEMENTS = [
  // 计数型成就
  {
    code: "ARTICLE_10",
    name: "笔耕不辍",
    description: "发布10篇文章",
    icon: "",
    type: "ARTICLE",
    rarity: "COMMON",
    condition: { type: "count", target: 10, event: "article.created" },
    rewardPoints: 50,
    rewardExp: 200,
    hidden: false,
    sort: 2,
  },
  // 阈值型成就
  {
    code: "LEVEL_10",
    name: "初窥门径",
    description: "达到10级",
    icon: "",
    type: "LEVEL",
    rarity: "COMMON",
    condition: { type: "threshold", target: 10, event: "user.levelUp" },
    rewardPoints: 50,
    rewardExp: 0,
    hidden: false,
    sort: 40,
  },
  // 连续型成就
  {
    code: "LOGIN_7_DAYS",
    name: "坚持不懈",
    description: "连续登录7天",
    icon: "",
    type: "SPECIAL",
    rarity: "COMMON",
    condition: { type: "consecutive", target: 7, event: "user.dailyLogin" },
    rewardPoints: 50,
    rewardExp: 200,
    hidden: false,
    sort: 50,
  },
  // 一次性成就
  {
    code: "PROFILE_COMPLETED",
    name: "完美档案",
    description: "完善个人资料",
    icon: "",
    type: "SPECIAL",
    rarity: "COMMON",
    condition: { type: "once", target: 1, event: "user.profileCompleted" },
    rewardPoints: 20,
    rewardExp: 100,
    hidden: false,
    sort: 53,
  },
];
```

---

## 使用示例

### 1. 发布事件触发成就

```typescript
// 在文章服务中
this.eventEmitter.emit("article.created", {
  userId: 123,
  articleId: 456,
});

// AchievementEventService 自动处理
// 更新用户123的文章相关成就进度
```

### 2. 手动更新成就进度

```typescript
await this.achievementService.updateProgress(userId, "FIRST_ARTICLE", 1);
```

### 3. 领取成就奖励

```typescript
// 单个领取
await this.achievementService.claimReward(userId, achievementId);

// 批量领取
await this.achievementService.claimAllRewards(userId);
```

### 4. 获取用户成就列表

```typescript
const achievements = await this.achievementService.findAll(user);
// 返回包含进度信息的成就列表
```
