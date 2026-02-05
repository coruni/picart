# 成就系统

## 概述

成就系统是一个完整的游戏化功能模块，用于激励用户参与平台活动。用户通过完成特定任务解锁成就，并获得积分、经验值或装饰品奖励。

## 功能特性

- ✅ 成就定义和管理
- ✅ 自动进度追踪
- ✅ 多种奖励类型（积分、经验、装饰品）
- ✅ 稀有度系统（普通、稀有、史诗、传说）
- ✅ 隐藏成就支持
- ✅ 批量领取奖励
- ✅ 事件驱动架构

## 数据库表结构

### achievement（成就表）
- `id`: 成就ID
- `code`: 成就代码（唯一标识）
- `name`: 成就名称
- `description`: 成就描述
- `icon`: 成就图标URL
- `type`: 成就类型（ARTICLE/COMMENT/SOCIAL/LEVEL/SPECIAL）
- `rarity`: 稀有度（COMMON/RARE/EPIC/LEGENDARY）
- `condition`: 完成条件（JSON格式）
- `rewardPoints`: 奖励积分
- `rewardExp`: 奖励经验
- `rewardDecorationId`: 奖励装饰品ID
- `hidden`: 是否隐藏
- `sort`: 排序
- `enabled`: 是否启用

### user_achievement（用户成就表）
- `id`: 记录ID
- `userId`: 用户ID
- `achievementId`: 成就ID
- `progress`: 当前进度
- `completed`: 是否已完成
- `completedAt`: 完成时间
- `claimed`: 是否已领取奖励
- `claimedAt`: 领取时间

## API 接口

### 用户接口

#### 1. 获取成就列表
```
GET /achievement
```
返回所有启用的成就，包含用户进度信息（需登录）

#### 2. 获取成就详情
```
GET /achievement/:id
```
获取单个成就的详细信息

#### 3. 获取用户成就统计
```
GET /achievement/stats
```
返回用户的成就完成情况统计

#### 4. 领取成就奖励
```
POST /achievement/:id/claim
```
领取指定成就的奖励

#### 5. 一键领取所有奖励
```
POST /achievement/claim-all
```
批量领取所有已完成但未领取的成就奖励

### 管理员接口

#### 1. 创建成就
```
POST /achievement
权限: achievement:manage
```

#### 2. 更新成就
```
PATCH /achievement/:id
权限: achievement:manage
```

#### 3. 删除成就
```
DELETE /achievement/:id
权限: achievement:manage
```

## 成就类型

### ARTICLE（文章相关）
- 发布文章
- 文章获得点赞
- 文章获得评论

### COMMENT（评论相关）
- 发表评论
- 评论获得点赞

### SOCIAL（社交相关）
- 关注用户
- 获得粉丝

### LEVEL（等级相关）
- 达到特定等级

### SPECIAL（特殊成就）
- 连续登录
- 成为会员
- 完善资料

## 事件监听

成就系统通过监听以下事件自动更新进度：

- `article.created` - 文章创建
- `article.receivedLike` - 文章被点赞
- `comment.created` - 评论创建
- `user.followed` - 关注用户
- `user.receivedFollow` - 被关注
- `user.dailyLogin` - 每日登录
- `user.levelUp` - 用户升级
- `membership.purchased` - 购买会员
- `user.profileCompleted` - 完善资料

## 初始化数据

系统提供了预定义的成就数据，位于 `achievement.seed.ts`。管理员可以通过 API 批量创建这些成就。

### 预定义成就列表

**文章相关：**
- 初出茅庐（发布1篇文章）
- 笔耕不辍（发布10篇文章）
- 著作等身（发布50篇文章）
- 文坛巨匠（发布100篇文章）

**点赞相关：**
- 初获认可（获得1个点赞）
- 人气作者（获得100个点赞）
- 万众瞩目（获得1000个点赞）

**评论相关：**
- 初次发声（发表1条评论）
- 热心网友（发表100条评论）

**社交相关：**
- 结识好友（关注1个用户）
- 社交达人（关注10个用户）
- 初获关注（获得1个粉丝）
- 小有名气（获得100个粉丝）
- 名声在外（获得1000个粉丝）

**等级相关：**
- 初窥门径（达到10级）
- 登堂入室（达到30级）
- 炉火纯青（达到50级）

**特殊成就：**
- 坚持不懈（连续登录7天）
- 持之以恒（连续登录30天）
- 尊贵会员（成为会员）
- 完美档案（完善个人资料）

## 使用示例

### 1. 创建成就（管理员）

```typescript
POST /achievement
{
  "code": "FIRST_ARTICLE",
  "name": "初出茅庐",
  "description": "发布第一篇文章",
  "type": "ARTICLE",
  "rarity": "COMMON",
  "condition": {
    "type": "count",
    "target": 1,
    "event": "article.created"
  },
  "rewardPoints": 10,
  "rewardExp": 50,
  "hidden": false,
  "sort": 1
}
```

### 2. 触发成就进度（自动）

当用户发布文章时，系统会自动触发：
```typescript
this.eventEmitter.emit('article.created', {
  userId: user.id,
  articleId: article.id,
});
```

成就事件服务会自动更新相关成就的进度。

### 3. 领取奖励（用户）

```typescript
POST /achievement/1/claim
```

返回：
```json
{
  "success": true,
  "message": "response.success.achievementClaimed",
  "data": {
    "points": 10,
    "exp": 50,
    "decorationId": null
  }
}
```

## 扩展开发

### 添加新成就

1. 在 `achievement.seed.ts` 中添加成就定义
2. 在 `achievement-event.service.ts` 中添加事件监听器
3. 在相关业务模块中触发事件

### 自定义条件类型

成就条件支持以下类型：
- `count`: 累计计数（如发布10篇文章）
- `threshold`: 阈值判断（如达到10级）
- `consecutive`: 连续计数（如连续登录7天）
- `once`: 一次性触发（如成为会员）

可以根据需要扩展更多条件类型。

## 注意事项

1. 成就进度是累加的，不会因为删除相关内容而减少
2. 已完成的成就不会重复计算进度
3. 奖励只能领取一次
4. 隐藏成就在未解锁前不会显示给用户
5. **成就勋章会自动作为装饰品添加到用户账户**
6. **成就勋章可以通过装饰品系统进行佩戴和展示**

## 成就勋章系统

### 自动生成勋章

当用户完成成就时，系统会自动：
1. 创建对应的成就勋章装饰品（类型：`ACHIEVEMENT_BADGE`）
2. 将勋章添加到用户的装饰品库
3. 勋章永久有效，可随时佩戴

### 勋章佩戴

成就勋章作为装饰品的一种，使用装饰品系统的接口进行管理：

**获取我的成就勋章：**
```
GET /decoration/achievement-badges/my
```

**佩戴成就勋章：**
```
POST /decoration/use/:decorationId
```

**取消佩戴：**
```
POST /decoration/unuse/:decorationId
```

**查看当前佩戴的装饰品（包括勋章）：**
```
GET /decoration/user/current/decorations
```

### 勋章展示

用户佩戴的成就勋章会在以下场景展示：
- 用户个人资料页
- 文章作者信息
- 评论区用户信息
- 其他需要展示用户装饰的地方

勋章与头像框、评论气泡等装饰品一样，通过 `userDecorations` 关联查询获取。

## 权限配置

需要在权限系统中添加以下权限：
- `achievement:manage` - 成就管理权限（创建、更新、删除成就）

## 国际化

所有提示信息都使用 i18n 键值，需要在语言文件中配置对应的翻译。

相关键值已添加到 `docs/i18n-keys.md`。
