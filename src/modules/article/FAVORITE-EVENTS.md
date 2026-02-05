# 文章收藏事件说明

## 事件列表

### article.favorited

**触发时机：** 用户收藏文章

**触发位置：** `src/modules/article/article.service.ts` - `favoriteArticle()` 方法

**Payload：**
```typescript
{
  userId: number;        // 收藏者ID
  articleId: number;     // 文章ID
  articleTitle: string;  // 文章标题
}
```

**监听器（需要实现）：**
- ⏳ **积分系统** (`PointsEventService`) - 收藏文章获得积分
- ⏳ **装饰品系统** (`DecorationEventService`) - 更新装饰品活动进度

**业务逻辑：**
- 收藏者获得积分（例如：每次收藏 +2 积分）
- 更新装饰品活动进度（如需要收藏数）

**积分规则代码示例：**
```typescript
// src/modules/points/points-event.service.ts
@OnEvent('article.favorited')
async handleArticleFavorited(payload: { userId: number; articleId: number }) {
  try {
    await this.pointsService.addPointsByRule(
      payload.userId,
      'FAVORITE_ARTICLE',
      'ARTICLE',
      payload.articleId,
    );
    console.log(`用户 ${payload.userId} 收藏文章获得积分`);
  } catch (error) {
    console.error('收藏文章增加积分失败:', error.message);
  }
}
```

---

### article.receivedFavorite

**触发时机：** 文章被收藏（给文章作者的奖励）

**触发位置：** `src/modules/article/article.service.ts` - `favoriteArticle()` 方法

**Payload：**
```typescript
{
  authorId: number;      // 文章作者ID
  articleId: number;     // 文章ID
  favoriterId: number;   // 收藏者ID
}
```

**监听器（需要实现）：**
- ⏳ **积分系统** (`PointsEventService`) - 文章作者获得积分
- ⏳ **等级系统** (`LevelEventService`) - 文章作者获得经验
- ⏳ **成就系统** (`AchievementEventService`) - 更新获得收藏相关成就进度
- ⏳ **通知系统** (`NotificationEventService`) - 发送收藏通知给文章作者

**业务逻辑：**
- 文章作者获得被收藏积分（例如：每次被收藏 +5 积分）
- 文章作者获得被收藏经验（例如：每次被收藏 +10 经验）
- 更新成就进度（第一个收藏、100个收藏、1000个收藏）
- 发送通知给作者

**积分规则代码示例：**
```typescript
// src/modules/points/points-event.service.ts
@OnEvent('article.receivedFavorite')
async handleArticleReceivedFavorite(payload: { 
  authorId: number; 
  articleId: number; 
  favoriterId: number 
}) {
  try {
    await this.pointsService.addPointsByRule(
      payload.authorId,
      'ARTICLE_RECEIVED_FAVORITE',
      'ARTICLE',
      payload.articleId,
    );
    console.log(`用户 ${payload.authorId} 的文章被收藏获得积分`);
  } catch (error) {
    console.error('文章被收藏增加积分失败:', error.message);
  }
}
```

**等级系统代码示例：**
```typescript
// src/modules/user/level-event.service.ts
@OnEvent('article.receivedFavorite')
async handleArticleReceivedFavorite(payload: { 
  authorId: number; 
  articleId: number 
}) {
  try {
    await this.levelService.addExperience(
      payload.authorId,
      10, // 被收藏获得10经验
      'ARTICLE_RECEIVED_FAVORITE',
      payload.articleId,
    );
    console.log(`用户 ${payload.authorId} 的文章被收藏获得经验`);
  } catch (error) {
    console.error('文章被收藏增加经验失败:', error.message);
  }
}
```

**通知系统代码示例：**
```typescript
// src/modules/message/notification-event.service.ts
@OnEvent('article.receivedFavorite')
async handleArticleReceivedFavorite(payload: {
  authorId: number;
  articleId: number;
  favoriterId: number;
}) {
  try {
    // 获取收藏者信息
    const favoriter = await this.userService.findOne(payload.favoriterId);
    
    // 发送通知
    await this.notificationService.createNotification({
      userId: payload.authorId,
      type: 'ARTICLE_FAVORITED',
      title: '文章被收藏',
      content: `${favoriter.nickname || favoriter.username} 收藏了你的文章`,
      relatedType: 'ARTICLE',
      relatedId: payload.articleId,
    });
    
    console.log(`已发送收藏通知给用户 ${payload.authorId}`);
  } catch (error) {
    console.error('发送收藏通知失败:', error.message);
  }
}
```

---

## 事件触发逻辑

```typescript
// 收藏文章时的事件触发逻辑
async favoriteArticle(articleId: number, userId: number) {
  // ... 创建收藏记录 ...
  
  try {
    // 1. 触发收藏者事件（奖励收藏者）
    this.eventEmitter.emit('article.favorited', {
      userId,
      articleId,
      articleTitle: article.title,
    });
    
    // 2. 触发作者事件（奖励作者）
    // 注意：如果是自己收藏自己的文章，不触发此事件
    if (article.author?.id && article.author.id !== userId) {
      this.eventEmitter.emit('article.receivedFavorite', {
        authorId: article.author.id,
        articleId,
        favoriterId: userId,
      });
    }
  } catch (error) {
    console.error('触发收藏事件失败:', error);
  }
}
```

## 与点赞事件的对比

| 特性 | 收藏事件 | 点赞事件 |
|------|---------|---------|
| 执行者事件 | `article.favorited` | `article.liked` |
| 接收者事件 | `article.receivedFavorite` | `article.receivedLike` |
| 执行者奖励 | 收藏文章获得积分 | 点赞文章获得积分 |
| 接收者奖励 | 文章被收藏获得积分+经验 | 文章被点赞获得积分+经验 |
| 通知 | 通知作者文章被收藏 | 通知作者文章被点赞 |
| 自己操作自己 | 不触发接收者事件 | 不触发接收者事件 |

## 积分规则建议

### 收藏者积分规则
```typescript
{
  code: 'FAVORITE_ARTICLE',
  name: '收藏文章',
  description: '收藏一篇文章',
  points: 2,
  dailyLimit: 20,  // 每天最多获得20次积分（防止刷分）
  type: 'REPEATABLE',
}
```

### 作者积分规则
```typescript
{
  code: 'ARTICLE_RECEIVED_FAVORITE',
  name: '文章被收藏',
  description: '你的文章被其他用户收藏',
  points: 5,
  dailyLimit: null,  // 无限制
  type: 'REPEATABLE',
}
```

## 实现清单

- [x] 创建收藏实体和接口
- [x] 触发 `article.favorited` 事件
- [x] 触发 `article.receivedFavorite` 事件
- [ ] 在积分系统中监听 `article.favorited` 事件
- [ ] 在积分系统中监听 `article.receivedFavorite` 事件
- [ ] 在等级系统中监听 `article.receivedFavorite` 事件
- [ ] 在成就系统中监听 `article.receivedFavorite` 事件
- [ ] 在通知系统中监听 `article.receivedFavorite` 事件
- [ ] 在装饰品系统中监听 `article.favorited` 事件
- [ ] 添加积分规则到数据库种子文件
- [ ] 更新 `docs/events.md` 文档
