# 装饰品系统

## 功能概述

装饰品系统允许用户获取和使用头像框、评论气泡等装饰品，支持购买、活动获取、赠送等多种方式。

## 主要功能

### 1. 装饰品类型
- **头像框 (AVATAR_FRAME)**: 用户头像的装饰边框
- **评论气泡 (COMMENT_BUBBLE)**: 评论显示的气泡样式

### 2. 获取方式
- **购买 (PURCHASE)**: 使用余额直接购买
- **活动 (ACTIVITY)**: 参与活动获取
- **赠送 (GIFT)**: 其他用户赠送
- **成就 (ACHIEVEMENT)**: 完成成就获取
- **默认 (DEFAULT)**: 系统默认装饰品

### 3. 稀有度
- **普通 (COMMON)**: 常见装饰品
- **稀有 (RARE)**: 稀有装饰品
- **史诗 (EPIC)**: 史诗级装饰品
- **传说 (LEGENDARY)**: 传说级装饰品

### 4. 有效期
- **永久**: 永久有效
- **限时**: 指定天数后过期

## 活动系统

### 活动类型
- **点赞活动 (LIKE)**: 点赞指定次数获取装饰品
- **评论活动 (COMMENT)**: 评论指定次数获取装饰品
- **分享活动 (SHARE)**: 分享指定次数获取装饰品
- **充值活动 (RECHARGE)**: 充值指定金额获取装饰品
- **签到活动 (SIGN_IN)**: 签到指定天数获取装饰品
- **自定义活动 (CUSTOM)**: 自定义条件

### 活动进度
系统自动追踪用户的活动进度：
- 当前点赞数
- 当前评论数
- 当前分享数
- 当前充值金额
- 当前签到天数

### 活动奖励
- 完成活动后可领取装饰品奖励
- 奖励可以是永久的或限时的
- 如果已拥有该装饰品，会延长有效期或升级为永久

## API 接口

### 装饰品管理

#### 创建装饰品
```
POST /decoration
```

请求体示例：
```json
{
  "name": "金色头像框",
  "type": "AVATAR_FRAME",
  "description": "华丽的金色头像框",
  "imageUrl": "https://example.com/frame.png",
  "rarity": "EPIC",
  "obtainMethod": "PURCHASE",
  "isPurchasable": true,
  "price": 99.00,
  "isPermanent": false,
  "validDays": 30
}
```

#### 获取装饰品列表
```
GET /decoration?type=AVATAR_FRAME&status=ACTIVE
```

#### 获取装饰品详情
```
GET /decoration/:id
```

#### 更新装饰品
```
PATCH /decoration/:id
```

#### 删除装饰品
```
DELETE /decoration/:id
```

### 用户操作

#### 购买装饰品
```
POST /decoration/purchase
```

请求体：
```json
{
  "decorationId": 1
}
```

#### 赠送装饰品
```
POST /decoration/gift
```

请求体：
```json
{
  "toUserId": 2,
  "decorationId": 1,
  "message": "送你一个头像框"
}
```

#### 获取我的装饰品
```
GET /decoration/user/my?type=AVATAR_FRAME
```

#### 获取用户的装饰品
```
GET /decoration/user/:userId?type=COMMENT_BUBBLE
```

#### 使用装饰品
```
POST /decoration/use/:decorationId
```

#### 取消使用装饰品
```
POST /decoration/unuse/:decorationId
```

#### 获取当前使用的装饰品
```
GET /decoration/user/current/decorations
```

返回示例：
```json
{
  "avatarFrame": {
    "id": 1,
    "decoration": {
      "name": "金色头像框",
      "imageUrl": "https://example.com/frame.png"
    }
  },
  "commentBubble": {
    "id": 2,
    "decoration": {
      "name": "粉色气泡",
      "imageUrl": "https://example.com/bubble.png"
    }
  }
}
```

### 活动相关

#### 领取活动奖励
```
POST /decoration/activity/claim/:activityId
```

#### 获取我的活动进度
```
GET /decoration/activity/progress/my
```

返回示例：
```json
[
  {
    "id": 1,
    "activityId": 1,
    "activity": {
      "name": "点赞100次送头像框",
      "requiredLikes": 100
    },
    "currentLikes": 50,
    "isCompleted": false,
    "isRewarded": false
  }
]
```

#### 清理过期装饰品
```
POST /decoration/clean-expired
```

## 数据库设计

### decoration 表（装饰品表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int | 装饰品ID |
| name | varchar(100) | 装饰品名称 |
| type | enum | 装饰品类型 |
| description | text | 装饰品描述 |
| imageUrl | text | 装饰品图片URL |
| previewUrl | text | 预览图URL |
| rarity | enum | 稀有度 |
| obtainMethod | enum | 获取方式 |
| isPurchasable | boolean | 是否可购买 |
| price | decimal(10,2) | 购买价格 |
| isPermanent | boolean | 是否永久 |
| validDays | int | 有效天数 |
| sort | int | 排序 |
| status | enum | 状态 |
| requiredLikes | int | 所需点赞数 |
| requiredComments | int | 所需评论数 |

### user_decoration 表（用户装饰品表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int | 记录ID |
| userId | int | 用户ID |
| decorationId | int | 装饰品ID |
| obtainMethod | enum | 获取方式 |
| isPermanent | boolean | 是否永久 |
| expiresAt | datetime | 过期时间 |
| isUsing | boolean | 是否正在使用 |
| giftFromUserId | int | 赠送人ID |
| orderId | int | 订单ID |
| activityId | int | 活动ID |
| remark | text | 备注 |

### decoration_activity 表（装饰品活动表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int | 活动ID |
| name | varchar(100) | 活动名称 |
| description | text | 活动描述 |
| type | enum | 活动类型 |
| decorationId | int | 奖励装饰品ID |
| requiredLikes | int | 所需点赞数 |
| requiredComments | int | 所需评论数 |
| requiredShares | int | 所需分享数 |
| requiredRecharge | decimal(10,2) | 所需充值金额 |
| requiredSignInDays | int | 所需签到天数 |
| isPermanent | boolean | 奖励是否永久 |
| validDays | int | 奖励有效天数 |
| startTime | datetime | 开始时间 |
| endTime | datetime | 结束时间 |
| status | enum | 状态 |
| participantCount | int | 参与人数 |
| completedCount | int | 完成人数 |

### user_activity_progress 表（用户活动进度表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int | 记录ID |
| userId | int | 用户ID |
| activityId | int | 活动ID |
| currentLikes | int | 当前点赞数 |
| currentComments | int | 当前评论数 |
| currentShares | int | 当前分享数 |
| currentRecharge | decimal(10,2) | 当前充值金额 |
| currentSignInDays | int | 当前签到天数 |
| isCompleted | boolean | 是否已完成 |
| isRewarded | boolean | 是否已领取奖励 |
| completedAt | datetime | 完成时间 |
| rewardedAt | datetime | 领取时间 |

## 事件系统

装饰品系统监听以下事件，自动更新用户活动进度：

### article.liked
**触发时机**: 当用户点赞文章时（仅限 reactionType 为 "like"）

**触发位置**: `src/modules/article/article.service.ts` 的 `like()` 方法

**事件数据**:
```typescript
{
  userId: number,      // 点赞用户ID
  articleId: number    // 文章ID
}
```

**处理逻辑**: 自动更新所有点赞类型活动的进度

### comment.created
**触发时机**: 当用户发表评论时（包括顶级评论和回复）

**触发位置**: `src/modules/comment/comment.service.ts` 的 `createComment()` 方法

**事件数据**:
```typescript
{
  userId: number,      // 评论用户ID
  articleId: number,   // 文章ID
  commentId: number    // 评论ID
}
```

**处理逻辑**: 自动更新所有评论类型活动的进度

### 事件处理特性
- ✅ 异步处理，不阻塞主业务流程
- ✅ 异常捕获，事件处理失败不影响点赞/评论操作
- ✅ 自动检查活动完成状态
- ✅ 完成后自动标记，可领取奖励

## 使用示例

### 前端展示用户装饰品

```typescript
// 获取用户当前使用的装饰品
const decorations = await fetch('/decoration/user/current/decorations');

// 在头像上应用头像框
if (decorations.avatarFrame) {
  avatarElement.style.border = `url(${decorations.avatarFrame.decoration.imageUrl})`;
}

// 在评论上应用气泡
if (decorations.commentBubble) {
  commentElement.style.background = `url(${decorations.commentBubble.decoration.imageUrl})`;
}
```

### 购买装饰品流程

```typescript
// 1. 获取装饰品列表
const decorations = await fetch('/decoration?type=AVATAR_FRAME');

// 2. 购买装饰品
const result = await fetch('/decoration/purchase', {
  method: 'POST',
  body: JSON.stringify({ decorationId: 1 })
});

// 3. 使用装饰品
await fetch('/decoration/use/1', { method: 'POST' });
```

### 活动进度展示

```typescript
// 获取活动进度
const progress = await fetch('/decoration/activity/progress/my');

// 显示进度条
progress.forEach(p => {
  const percentage = (p.currentLikes / p.activity.requiredLikes) * 100;
  progressBar.style.width = `${percentage}%`;
  
  // 如果完成但未领取，显示领取按钮
  if (p.isCompleted && !p.isRewarded) {
    showClaimButton(p.activityId);
  }
});
```

## 特性

1. **自动进度追踪**: 用户点赞、评论时自动更新活动进度
2. **防重复购买**: 已拥有的装饰品不能重复购买
3. **过期管理**: 自动清理过期的装饰品
4. **赠送功能**: 用户可以将装饰品赠送给其他用户
5. **余额支付**: 使用钱包余额购买，带事务保护
6. **活动奖励**: 完成活动可领取装饰品奖励
7. **有效期管理**: 支持永久和限时装饰品

## 注意事项

1. 购买装饰品会扣除用户余额，使用事务确保安全
2. 赠送装饰品不会消耗赠送者的装饰品
3. 同一类型的装饰品只能同时使用一个
4. 过期的装饰品会自动取消使用状态
5. 活动奖励只能领取一次

## 后续优化建议

1. 添加装饰品商城页面
2. 添加装饰品预览功能
3. 添加装饰品合成系统
4. 添加装饰品交易市场
5. 添加装饰品抽奖系统
6. 添加装饰品成就系统
7. 添加装饰品排行榜

---

**创建日期**: 2025-01-11
**版本**: v1.0.0
