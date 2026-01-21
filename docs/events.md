# 系统事件文档

本文档列出了系统中所有的事件及其监听器，方便开发者了解事件驱动架构。

## 目录

- [文章相关事件](#文章相关事件)
- [评论相关事件](#评论相关事件)
- [用户相关事件](#用户相关事件)
- [成就相关事件](#成就相关事件)
- [装饰品相关事件](#装饰品相关事件)
- [系统相关事件](#系统相关事件)
- [事件监听器汇总](#事件监听器汇总)

---

## 文章相关事件

### article.created

**触发时机：** 用户发布文章（状态为 PUBLISHED）

**触发位置：** `src/modules/article/article.service.ts`

**Payload：**
```typescript
{
  userId: number;      // 作者ID
  articleId: number;   // 文章ID
}
```

**监听器：**
- ✅ **积分系统** (`PointsEventService`) - 发布文章获得积分
- ✅ **等级系统** (`LevelEventService`) - 发布文章获得经验
- ✅ **成就系统** (`AchievementEventService`) - 更新文章发布相关成就进度

**业务逻辑：**
- 用户获得发布文章积分
- 用户获得发布文章经验
- 更新成就进度（第一篇文章、10篇文章、50篇文章、100篇文章）

---

### article.liked

**触发时机：** 用户点赞文章（reaction 类型为 "like"）

**触发位置：** `src/modules/article/article.service.ts`

**Payload：**
```typescript
{
  userId: number;      // 点赞用户ID
  articleId: number;   // 文章ID
  userName?: string;   // 点赞用户名称
}
```

**监听器：**
- ✅ **积分系统** (`PointsEventService`) - 点赞文章获得积分
- ✅ **通知系统** (`NotificationEventService`) - 发送点赞通知给文章作者
- ✅ **装饰品系统** (`DecorationEventService`) - 更新装饰品活动进度

**业务逻辑：**
- 点赞用户获得积分
- 文章作者收到点赞通知
- 更新装饰品活动进度（如需要点赞数）

---

### article.receivedLike

**触发时机：** 文章被点赞（给文章作者的奖励）

**触发位置：** `src/modules/article/article.service.ts`

**Payload：**
```typescript
{
  authorId: number;    // 文章作者ID
  articleId: number;   // 文章ID
  likerId: number;     // 点赞用户ID
}
```

**监听器：**
- ✅ **积分系统** (`PointsEventService`) - 文章作者获得积分
- ✅ **等级系统** (`LevelEventService`) - 文章作者获得经验
- ✅ **成就系统** (`AchievementEventService`) - 更新获得点赞相关成就进度

**业务逻辑：**
- 文章作者获得被点赞积分
- 文章作者获得被点赞经验
- 更新成就进度（第一个点赞、100个点赞、1000个点赞）

---

### article.receivedComment

**触发时机：** 文章被评论（给文章作者的奖励）

**触发位置：** `src/modules/comment/comment.service.ts`

**Payload：**
```typescript
{
  authorId: number;      // 文章作者ID
  articleId: number;     // 文章ID
  commentId: number;     // 评论ID
  commenterId: number;   // 评论用户ID
}
```

**监听器：**
- ✅ **积分系统** (`PointsEventService`) - 文章作者获得积分
- ✅ **等级系统** (`LevelEventService`) - 文章作者获得经验

**业务逻辑：**
- 文章作者获得被评论积分
- 文章作者获得被评论经验

---

## 评论相关事件

### comment.created

**触发时机：** 用户发表评论

**触发位置：** `src/modules/comment/comment.service.ts`

**Payload：**
```typescript
{
  userId: number;      // 评论用户ID
  userName?: string;   // 评论用户名称
  articleId: number;   // 文章ID
  commentId: number;   // 评论ID
}
```

**监听器：**
- ✅ **积分系统** (`PointsEventService`) - 发表评论获得积分
- ✅ **等级系统** (`LevelEventService`) - 发表评论获得经验
- ✅ **成就系统** (`AchievementEventService`) - 更新评论相关成就进度
- ✅ **通知系统** (`NotificationEventService`) - 发送评论通知
- ✅ **装饰品系统** (`DecorationEventService`) - 更新装饰品活动进度

**业务逻辑：**
- 评论用户获得积分和经验
- 文章作者收到评论通知
- 更新成就进度（第一条评论、100条评论）
- 更新装饰品活动进度（如需要评论数）

---

### comment.liked

**触发时机：** 用户点赞评论

**触发位置：** `src/modules/comment/comment.service.ts`

**Payload：**
```typescript
{
  userId: number;       // 点赞用户ID
  userName?: string;    // 点赞用户名称
  commentId: number;    // 评论ID
  articleId?: number;   // 文章ID（可选）
}
```

**监听器：**
- ✅ **积分系统** (`PointsEventService`) - 点赞评论获得积分
- ✅ **通知系统** (`NotificationEventService`) - 发送点赞通知给评论作者

**业务逻辑：**
- 点赞用户获得积分
- 评论作者收到点赞通知

---

### comment.receivedLike

**触发时机：** 评论被点赞（给评论作者的奖励）

**触发位置：** `src/modules/comment/comment.service.ts`

**Payload：**
```typescript
{
  authorId: number;    // 评论作者ID
  commentId: number;   // 评论ID
  likerId: number;     // 点赞用户ID
}
```

**监听器：**
- ✅ **积分系统** (`PointsEventService`) - 评论作者获得积分
- ✅ **等级系统** (`LevelEventService`) - 评论作者获得经验

**业务逻辑：**
- 评论作者获得被点赞积分
- 评论作者获得被点赞经验

---

## 用户相关事件

### user.dailyLogin

**触发时机：** 用户每日首次登录/签到

**触发位置：** `src/modules/user/user.service.ts`

**Payload：**
```typescript
{
  userId: number;           // 用户ID
  consecutiveDays?: number; // 连续登录天数（可选）
}
```

**监听器：**
- ✅ **积分系统** (`PointsEventService`) - 每日登录获得积分
- ✅ **等级系统** (`LevelEventService`) - 每日登录获得经验
- ✅ **成就系统** (`AchievementEventService`) - 更新连续登录成就进度

**业务逻辑：**
- 用户获得每日登录积分和经验
- 更新成就进度（连续登录7天、30天）

---

### user.followed

**触发时机：** 用户关注其他用户

**触发位置：** `src/modules/user/user.service.ts`

**Payload：**
```typescript
{
  userId: number;        // 关注者ID
  targetUserId: number;  // 被关注者ID
}
```

**监听器：**
- ✅ **等级系统** (`LevelEventService`) - 关注用户获得经验
- ✅ **成就系统** (`AchievementEventService`) - 更新关注相关成就进度
- ✅ **通知系统** (`NotificationEventService`) - 发送关注通知

**业务逻辑：**
- 关注者获得经验
- 更新成就进度（第一个关注、关注10个用户）
- 被关注者收到关注通知

---

### user.receivedFollow

**触发时机：** 用户被其他用户关注

**触发位置：** `src/modules/user/user.service.ts`

**Payload：**
```typescript
{
  userId: number;      // 被关注者ID
  followerId: number;  // 关注者ID
}
```

**监听器：**
- ✅ **成就系统** (`AchievementEventService`) - 更新粉丝相关成就进度

**业务逻辑：**
- 更新成就进度（第一个粉丝、100个粉丝、1000个粉丝）

---

### user.levelUp

**触发时机：** 用户等级提升

**触发位置：** `src/modules/user/level-event.service.ts`

**Payload：**
```typescript
{
  userId: number;  // 用户ID
  level: number;   // 新等级
}
```

**监听器：**
- ✅ **成就系统** (`AchievementEventService`) - 更新等级相关成就进度

**业务逻辑：**
- 更新成就进度（达到10级、30级、50级）

---

### user.profileCompleted

**触发时机：** 用户完善个人资料

**触发位置：** `src/modules/user/user.service.ts`

**Payload：**
```typescript
{
  userId: number;  // 用户ID
}
```

**监听器：**
- ✅ **等级系统** (`LevelEventService`) - 完善资料获得经验（一次性）
- ✅ **成就系统** (`AchievementEventService`) - 更新资料完善成就

**业务逻辑：**
- 用户获得完善资料经验（仅一次）
- 解锁"完美档案"成就

---

### user.gainExp

**触发时机：** 用户获得经验值（通用事件）

**触发位置：** `src/modules/achievement/achievement.service.ts`

**Payload：**
```typescript
{
  userId: number;  // 用户ID
  exp: number;     // 经验值
  reason: string;  // 获得原因
}
```

**监听器：**
- ✅ **等级系统** (`LevelEventService`) - 增加用户经验值

**业务逻辑：**
- 增加用户经验值
- 检查是否升级

---

## 成就相关事件

### achievement.completed

**触发时机：** 用户完成成就

**触发位置：** `src/modules/achievement/achievement.service.ts`

**Payload：**
```typescript
{
  userId: number;          // 用户ID
  achievementId: number;   // 成就ID
  achievementCode: string; // 成就代码
}
```

**监听器：**
- 暂无（可扩展用于发送通知、统计等）

**业务逻辑：**
- 自动创建成就勋章装饰品
- 添加到用户装饰品库

---

## 装饰品相关事件

### decoration.purchased

**触发时机：** 用户购买装饰品

**触发位置：** `src/modules/decoration/decoration.service.ts`

**Payload：**
```typescript
{
  userId: number;        // 用户ID
  decorationId: number;  // 装饰品ID
  amount: number;        // 消费金额
}
```

**监听器：**
- ✅ **积分系统** (`PointsEventService`) - 扣除积分

**业务逻辑：**
- 扣除用户积分
- 添加装饰品到用户库

---

### decoration.grant

**触发时机：** 系统授予用户装饰品（如成就奖励）

**触发位置：** `src/modules/achievement/achievement.service.ts`

**Payload：**
```typescript
{
  userId: number;        // 用户ID
  decorationId: number;  // 装饰品ID
  obtainMethod: string;  // 获取方式
}
```

**监听器：**
- 暂无（可扩展）

**业务逻辑：**
- 添加装饰品到用户库
- 记录获取方式

---

## 系统相关事件

### membership.purchased

**触发时机：** 用户购买会员

**触发位置：** `src/modules/order/order.service.ts`

**Payload：**
```typescript
{
  userId: number;   // 用户ID
  orderId: number;  // 订单ID
}
```

**监听器：**
- ✅ **等级系统** (`LevelEventService`) - 购买会员获得经验
- ✅ **成就系统** (`AchievementEventService`) - 解锁会员成就

**业务逻辑：**
- 用户获得购买会员经验
- 解锁"尊贵会员"成就

---

### config.updated

**触发时机：** 系统配置更新

**触发位置：** `src/modules/config/config.service.ts`

**Payload：**
```typescript
{
  group?: string;  // 配置组（可选）
}
```

**监听器：**
- ✅ **支付系统** (`PaymentService`) - 重新初始化支付SDK

**业务逻辑：**
- 重新加载支付配置
- 重新初始化支付SDK

---

### system.notification

**触发时机：** 系统发送通知

**触发位置：** 各个模块

**Payload：**
```typescript
{
  userId: number;      // 接收用户ID
  title: string;       // 通知标题
  content: string;     // 通知内容
  type?: string;       // 通知类型
  relatedId?: number;  // 关联ID
}
```

**监听器：**
- ✅ **通知系统** (`NotificationEventService`) - 创建系统通知

**业务逻辑：**
- 创建系统通知记录
- 推送通知给用户

---

### task.progress

**触发时机：** 任务进度更新

**触发位置：** 各个模块

**Payload：**
```typescript
{
  userId: number;      // 用户ID
  taskCode: string;    // 任务代码
  increment?: number;  // 增量（可选，默认1）
}
```

**监听器：**
- ✅ **积分系统** (`PointsEventService`) - 更新任务进度

**业务逻辑：**
- 更新用户任务进度
- 检查任务是否完成
- 发放任务奖励

---

## 事件监听器汇总

### 积分系统 (PointsEventService)

监听的事件：
- `article.created` - 发布文章获得积分
- `article.liked` - 点赞文章获得积分
- `article.receivedLike` - 文章被点赞，作者获得积分
- `article.receivedComment` - 文章被评论，作者获得积分
- `comment.created` - 发表评论获得积分
- `comment.liked` - 点赞评论获得积分
- `comment.receivedLike` - 评论被点赞，作者获得积分
- `user.dailyLogin` - 每日登录获得积分
- `decoration.purchased` - 购买装饰品扣除积分
- `task.progress` - 更新任务进度

### 等级系统 (LevelEventService)

监听的事件：
- `article.created` - 发布文章获得经验
- `article.receivedLike` - 文章被点赞，作者获得经验
- `article.receivedComment` - 文章被评论，作者获得经验
- `comment.created` - 发表评论获得经验
- `comment.receivedLike` - 评论被点赞，作者获得经验
- `user.dailyLogin` - 每日登录获得经验
- `user.followed` - 关注用户获得经验
- `membership.purchased` - 购买会员获得经验
- `user.profileCompleted` - 完善资料获得经验

### 成就系统 (AchievementEventService)

监听的事件：
- `article.created` - 更新文章发布成就
- `article.receivedLike` - 更新获得点赞成就
- `comment.created` - 更新评论发布成就
- `user.followed` - 更新关注用户成就
- `user.receivedFollow` - 更新获得粉丝成就
- `user.dailyLogin` - 更新连续登录成就
- `user.levelUp` - 更新等级成就
- `membership.purchased` - 解锁会员成就
- `user.profileCompleted` - 解锁资料完善成就

### 通知系统 (NotificationEventService)

监听的事件：
- `article.liked` - 发送文章点赞通知
- `comment.liked` - 发送评论点赞通知
- `comment.created` - 发送评论通知
- `user.followed` - 发送关注通知
- `system.notification` - 发送系统通知

### 装饰品系统 (DecorationEventService)

监听的事件：
- `article.liked` - 更新装饰品活动进度（点赞）
- `comment.created` - 更新装饰品活动进度（评论）

### 支付系统 (PaymentService)

监听的事件：
- `config.updated` - 重新初始化支付SDK

---

## 事件使用示例

### 触发事件

```typescript
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class ArticleService {
  constructor(private eventEmitter: EventEmitter2) {}

  async createArticle(dto: CreateArticleDto, author: User) {
    // ... 创建文章逻辑
    
    // 触发文章创建事件
    this.eventEmitter.emit('article.created', {
      userId: author.id,
      articleId: savedArticle.id,
    });
    
    return savedArticle;
  }
}
```

### 监听事件

```typescript
import { OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class PointsEventService {
  @OnEvent('article.created')
  async handleArticleCreated(payload: { userId: number; articleId: number }) {
    // 处理事件逻辑
    await this.pointsService.addPointsByRule(
      payload.userId,
      'ARTICLE_PUBLISH'
    );
  }
}
```

---

## 事件命名规范

### 格式

```
<模块>.<动作>
```

### 示例

- `article.created` - 文章被创建
- `article.liked` - 文章被点赞
- `article.receivedLike` - 文章收到点赞（强调接收方）
- `user.followed` - 用户关注了其他人
- `user.receivedFollow` - 用户被其他人关注

### 规则

1. 使用小写字母和点号分隔
2. 模块名使用单数形式
3. 动作使用过去式
4. 如果强调接收方，使用 `received` 前缀

---

## 扩展建议

### 添加新事件

1. 在触发位置使用 `eventEmitter.emit()`
2. 创建或更新事件监听器服务
3. 使用 `@OnEvent()` 装饰器监听事件
4. 更新本文档

### 事件监听器最佳实践

1. **异步处理** - 使用 `async/await`
2. **错误处理** - 使用 `try-catch` 捕获异常
3. **日志记录** - 记录事件处理日志
4. **幂等性** - 确保重复触发不会产生副作用
5. **性能优化** - 避免在事件处理中执行耗时操作

### 示例

```typescript
@OnEvent('article.created')
async handleArticleCreated(payload: { userId: number; articleId: number }) {
  try {
    // 异步处理
    await this.pointsService.addPoints(payload.userId, 10);
    
    // 日志记录
    console.log(`用户 ${payload.userId} 发布文章获得积分`);
  } catch (error) {
    // 错误处理
    console.error('处理文章创建事件失败:', error);
  }
}
```

---

## 总结

系统当前共有 **20+** 个事件，涵盖：
- 文章相关：5个事件
- 评论相关：3个事件
- 用户相关：6个事件
- 成就相关：1个事件
- 装饰品相关：2个事件
- 系统相关：3个事件

这些事件通过 **6个事件监听器服务** 处理：
- 积分系统
- 等级系统
- 成就系统
- 通知系统
- 装饰品系统
- 支付系统

事件驱动架构使系统各模块解耦，便于扩展和维护。
