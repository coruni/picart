# 成就系统与装饰品系统集成说明

## 概述

成就系统已完全集成到装饰品系统中，用户完成成就后会自动获得对应的成就勋章装饰品，可以像其他装饰品一样进行佩戴和展示。

## 集成架构

```
成就系统 (Achievement)
    ↓ 完成成就
自动创建勋章装饰品 (Decoration: ACHIEVEMENT_BADGE)
    ↓ 添加到用户
用户装饰品库 (UserDecoration)
    ↓ 佩戴/展示
装饰品展示系统
```

## 数据流程

### 1. 成就完成流程

```typescript
用户触发事件 (如发布文章)
  ↓
AchievementEventService 监听事件
  ↓
AchievementService.updateProgress() 更新进度
  ↓
检查是否达成条件
  ↓ (达成)
grantAchievementBadge() 授予勋章
  ↓
创建/查找 Decoration (type: ACHIEVEMENT_BADGE)
  ↓
创建 UserDecoration 记录
  ↓
用户获得成就勋章
```

### 2. 勋章佩戴流程

```typescript
用户请求佩戴勋章
  ↓
POST /decoration/use/:decorationId
  ↓
DecorationService.useDecoration()
  ↓
检查装饰品类型和权限
  ↓
取消同类型其他装饰品
  ↓
设置当前勋章为使用中
  ↓
勋章在用户资料中展示
```

## 数据库表关系

```
achievement (成就表)
  ├─ id
  ├─ code (成就代码)
  ├─ name (成就名称)
  ├─ icon (成就图标)
  ├─ rarity (稀有度)
  └─ rewardDecorationId → decoration.id

decoration (装饰品表)
  ├─ id
  ├─ name (装饰品名称)
  ├─ type (ACHIEVEMENT_BADGE)
  ├─ imageUrl (图标URL)
  ├─ rarity (稀有度)
  └─ obtainMethod (ACHIEVEMENT)

user_achievement (用户成就表)
  ├─ userId
  ├─ achievementId
  ├─ completed (是否完成)
  └─ claimed (是否领取奖励)

user_decoration (用户装饰品表)
  ├─ userId
  ├─ decorationId
  ├─ obtainMethod (ACHIEVEMENT)
  ├─ isUsing (是否佩戴中)
  └─ isPermanent (true - 永久有效)
```

## API 接口

### 成就相关

| 接口 | 方法 | 说明 |
|------|------|------|
| `/achievement` | GET | 获取成就列表（含进度） |
| `/achievement/:id` | GET | 获取成就详情 |
| `/achievement/stats` | GET | 获取用户成就统计 |
| `/achievement/:id/claim` | POST | 领取成就奖励 |
| `/achievement/claim-all` | POST | 一键领取所有奖励 |

### 勋章相关

| 接口 | 方法 | 说明 |
|------|------|------|
| `/decoration/achievement-badges/my` | GET | 获取我的成就勋章 |
| `/decoration/use/:decorationId` | POST | 佩戴勋章 |
| `/decoration/unuse/:decorationId` | POST | 取消佩戴 |
| `/decoration/user/current/decorations` | GET | 查看当前佩戴的装饰品 |
| `/decoration/user/my?type=ACHIEVEMENT_BADGE` | GET | 获取我的装饰品（筛选勋章） |

## 装饰品类型

系统现在支持三种装饰品类型：

1. **AVATAR_FRAME** - 头像框
2. **COMMENT_BUBBLE** - 评论气泡
3. **ACHIEVEMENT_BADGE** - 成就勋章 ⭐ 新增

## 自动化流程

### 成就完成时自动执行

1. ✅ 检查是否已存在对应的勋章装饰品
2. ✅ 如果不存在，自动创建勋章装饰品
3. ✅ 将勋章添加到用户的装饰品库
4. ✅ 更新成就的 `rewardDecorationId` 字段
5. ✅ 勋章设置为永久有效

### 勋章属性

- **名称格式**: `成就勋章：{成就名称}`
- **类型**: `ACHIEVEMENT_BADGE`
- **图标**: 使用成就的 `icon` 字段
- **稀有度**: 继承成就的 `rarity`
- **获取方式**: `ACHIEVEMENT`
- **有效期**: 永久
- **可购买**: 否

## 前端展示建议

### 1. 成就列表页

```typescript
// 显示成就及其对应的勋章
{
  achievement: {
    id: 1,
    name: "初出茅庐",
    icon: "/icons/first-article.png",
    completed: true,
    claimed: true
  },
  badge: {
    id: 101,
    name: "成就勋章：初出茅庐",
    isOwned: true,
    isUsing: false
  }
}
```

### 2. 用户资料页

```typescript
// 显示用户佩戴的勋章
{
  userDecorations: {
    AVATAR_FRAME: { ... },
    COMMENT_BUBBLE: { ... },
    ACHIEVEMENT_BADGE: {
      id: 101,
      name: "成就勋章：初出茅庐",
      imageUrl: "/icons/first-article.png",
      rarity: "COMMON"
    }
  }
}
```

### 3. 勋章墙

```typescript
// 展示用户所有获得的勋章
GET /decoration/achievement-badges/my

// 响应
{
  data: [
    {
      decoration: {
        id: 101,
        name: "成就勋章：初出茅庐",
        imageUrl: "/icons/first-article.png",
        rarity: "COMMON"
      },
      isUsing: true,
      createdAt: "2024-01-01T00:00:00Z"
    },
    // ...
  ],
  total: 5,
  page: 1,
  limit: 20
}
```

## 使用示例

### 1. 用户完成成就（自动）

```typescript
// 用户发布第一篇文章
this.eventEmitter.emit('article.created', {
  userId: 1,
  articleId: 100,
});

// 系统自动：
// 1. 更新成就进度
// 2. 检测到完成"初出茅庐"成就
// 3. 创建成就勋章装饰品
// 4. 添加到用户装饰品库
```

### 2. 用户佩戴勋章

```typescript
// 前端调用
POST /decoration/use/101

// 响应
{
  id: 1,
  userId: 1,
  decorationId: 101,
  isUsing: true,
  decoration: {
    id: 101,
    name: "成就勋章：初出茅庐",
    type: "ACHIEVEMENT_BADGE",
    imageUrl: "/icons/first-article.png"
  }
}
```

### 3. 查看用户佩戴的装饰品

```typescript
// 前端调用
GET /decoration/user/current/decorations

// 响应
{
  avatarFrame: { ... },
  commentBubble: { ... },
  achievementBadge: {
    id: 101,
    name: "成就勋章：初出茅庐",
    imageUrl: "/icons/first-article.png",
    rarity: "COMMON"
  }
}
```

## 注意事项

1. **自动创建**: 勋章装饰品在成就完成时自动创建，无需手动管理
2. **永久有效**: 所有成就勋章都是永久有效的
3. **唯一性**: 每个成就对应一个勋章装饰品
4. **佩戴限制**: 同一时间只能佩戴一个成就勋章
5. **图标同步**: 勋章图标使用成就的 `icon` 字段，更新成就图标会影响已创建的勋章

## 扩展建议

### 1. 勋章展示位置

- 用户头像旁边
- 评论区用户名旁边
- 文章作者信息区
- 排行榜用户列表
- 个人主页顶部

### 2. 勋章特效

可以根据稀有度添加不同的视觉效果：
- COMMON: 普通边框
- RARE: 蓝色光效
- EPIC: 紫色光效
- LEGENDARY: 金色光效 + 动画

### 3. 勋章墙

创建专门的勋章展示页面：
- 按稀有度分类
- 按获得时间排序
- 显示获得进度
- 支持一键佩戴

## 测试建议

### 单元测试

```typescript
describe('Achievement Badge Integration', () => {
  it('should create badge decoration when achievement completed', async () => {
    // 测试完成成就时自动创建勋章
  });

  it('should add badge to user decorations', async () => {
    // 测试勋章添加到用户装饰品库
  });

  it('should allow user to equip badge', async () => {
    // 测试用户佩戴勋章
  });

  it('should unequip other badges when equipping new one', async () => {
    // 测试佩戴新勋章时取消旧勋章
  });
});
```

### 集成测试

1. 完成成就 → 检查勋章是否创建
2. 佩戴勋章 → 检查是否正确显示
3. 取消佩戴 → 检查状态更新
4. 查询勋章列表 → 检查数据完整性

## 总结

成就系统与装饰品系统的集成实现了：

✅ 自动化勋章生成
✅ 统一的装饰品管理
✅ 灵活的佩戴机制
✅ 完整的展示系统
✅ 良好的扩展性

用户完成成就后可以立即获得并佩戴对应的勋章，提升了用户的成就感和参与度。
