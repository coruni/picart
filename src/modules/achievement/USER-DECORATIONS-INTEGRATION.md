# 用户装饰品数据挂载说明

## 概述

用户装饰品数据（包括成就勋章）已经完整集成到系统中，在多个模块中自动加载和处理。

## 数据结构

### User 实体关联

```typescript
@Entity()
export class User {
  // ... 其他字段
  
  @OneToMany(() => UserDecoration, (userDecoration) => userDecoration.user)
  userDecorations: UserDecoration[];
}
```

### 处理后的数据格式

```typescript
{
  id: 1,
  username: "user123",
  // ... 其他用户字段
  
  // 原始关联数据（查询时加载）
  userDecorations: [
    {
      id: 1,
      isUsing: true,
      decoration: {
        id: 101,
        name: "成就勋章：初出茅庐",
        type: "ACHIEVEMENT_BADGE",
        imageUrl: "/icons/badge.png",
        rarity: "COMMON"
      }
    },
    // ...
  ],
  
  // 处理后的数据（前端友好格式）
  equippedDecorations: {
    AVATAR_FRAME: { id, name, type, imageUrl, rarity },
    COMMENT_BUBBLE: { id, name, type, imageUrl, rarity },
    ACHIEVEMENT_BADGE: { id, name, type, imageUrl, rarity }
  }
}
```

## 已集成的模块

### 1. 文章模块 (Article)

**加载位置：**
- 创建文章后重新查询
- 查询文章列表
- 查询文章详情
- 根据作者查询文章
- 浏览历史

**Relations 配置：**
```typescript
relations: [
  "author", 
  "author.userDecorations", 
  "author.userDecorations.decoration",
  // ...
]
```

**处理方式：**
```typescript
// 使用 processUserDecorations 转换格式
articleWithDownloads.author = sanitizeUser(
  processUserDecorations(articleWithDownloads.author)
);
```

### 2. 评论模块 (Comment)

**加载位置：**
- 查询评论列表
- 查询评论详情
- 查询评论回复

**Relations 配置：**
```typescript
relations: [
  "author", 
  "author.userDecorations", 
  "author.userDecorations.decoration",
  "parent", 
  "parent.author", 
  "parent.author.userDecorations", 
  "parent.author.userDecorations.decoration"
]
```

**处理方式：**
```typescript
// 评论作者
comment.author = processUserDecorations(comment.author);

// 父评论作者
comment.parent.author = processUserDecorations(comment.parent.author);
```

### 3. 用户模块 (User)

**加载位置：**
- 查询用户列表
- 查询用户详情
- 查询关注列表
- 查询粉丝列表
- 获取当前用户信息

**Relations 配置：**
```typescript
relations: [
  "userDecorations", 
  "userDecorations.decoration"
]
```

**处理方式：**
```typescript
// 在返回前处理
const processedUser = processUserDecorations(user);
```

## 工具函数

### processUserDecorations()

**功能：** 将 `userDecorations` 关系数据转换为前端友好的 `equippedDecorations` 格式

**输入：**
```typescript
{
  id: 1,
  username: "user",
  userDecorations: [
    { isUsing: true, decoration: { type: "AVATAR_FRAME", ... } },
    { isUsing: true, decoration: { type: "ACHIEVEMENT_BADGE", ... } },
    { isUsing: false, decoration: { type: "COMMENT_BUBBLE", ... } }
  ]
}
```

**输出：**
```typescript
{
  id: 1,
  username: "user",
  equippedDecorations: {
    AVATAR_FRAME: { id, name, type, imageUrl, rarity },
    ACHIEVEMENT_BADGE: { id, name, type, imageUrl, rarity }
    // 注意：isUsing=false 的不会包含
  }
}
```

**特点：**
- 只包含 `isUsing: true` 的装饰品
- 按类型分组（AVATAR_FRAME, COMMENT_BUBBLE, ACHIEVEMENT_BADGE）
- 移除原始的 `userDecorations` 数组
- 简化数据结构，便于前端使用

### processUsersDecorations()

**功能：** 批量处理用户数组的装饰品数据

```typescript
const users = await userRepository.find({
  relations: ["userDecorations", "userDecorations.decoration"]
});

const processedUsers = processUsersDecorations(users);
```

## 前端使用示例

### 1. 显示用户头像框

```typescript
// 文章作者信息
const article = await getArticle(id);

// 头像框
const avatarFrame = article.author.equippedDecorations?.AVATAR_FRAME;
if (avatarFrame) {
  <img src={avatarFrame.imageUrl} class="avatar-frame" />
}
```

### 2. 显示成就勋章

```typescript
// 用户资料页
const user = await getUser(id);

// 成就勋章
const badge = user.equippedDecorations?.ACHIEVEMENT_BADGE;
if (badge) {
  <div class={`badge badge-${badge.rarity.toLowerCase()}`}>
    <img src={badge.imageUrl} />
    <span>{badge.name}</span>
  </div>
}
```

### 3. 显示评论气泡

```typescript
// 评论列表
const comments = await getComments(articleId);

comments.forEach(comment => {
  const bubble = comment.author.equippedDecorations?.COMMENT_BUBBLE;
  if (bubble) {
    <div class="comment" style={`background-image: url(${bubble.imageUrl})`}>
      {comment.content}
    </div>
  }
});
```

### 4. 显示所有装饰品

```typescript
// 用户卡片
const user = await getUser(id);
const decorations = user.equippedDecorations;

if (decorations) {
  Object.entries(decorations).forEach(([type, decoration]) => {
    console.log(`${type}: ${decoration.name}`);
  });
}

// 输出示例：
// AVATAR_FRAME: 金色边框
// ACHIEVEMENT_BADGE: 成就勋章：初出茅庐
```

## 装饰品类型

系统支持三种装饰品类型：

| 类型 | 说明 | 展示位置 |
|------|------|---------|
| `AVATAR_FRAME` | 头像框 | 用户头像周围 |
| `COMMENT_BUBBLE` | 评论气泡 | 评论内容背景 |
| `ACHIEVEMENT_BADGE` | 成就勋章 | 用户名旁边/个人资料 |

## 数据加载流程

```
1. 查询用户数据
   ↓
2. 通过 relations 加载 userDecorations
   ↓
3. 通过 relations 加载 decoration
   ↓
4. 使用 processUserDecorations() 处理
   ↓
5. 转换为 equippedDecorations 格式
   ↓
6. 返回给前端
```

## 性能优化

### 1. 使用 relations 预加载

```typescript
// ✅ 好的做法 - 一次查询获取所有数据
const user = await userRepository.findOne({
  where: { id },
  relations: ["userDecorations", "userDecorations.decoration"]
});

// ❌ 不好的做法 - N+1 查询问题
const user = await userRepository.findOne({ where: { id } });
const decorations = await userDecorationRepository.find({ 
  where: { userId: user.id } 
});
```

### 2. 批量处理

```typescript
// ✅ 批量处理多个用户
const users = await userRepository.find({
  relations: ["userDecorations", "userDecorations.decoration"]
});
const processedUsers = processUsersDecorations(users);

// ❌ 逐个处理
for (const user of users) {
  user.equippedDecorations = await getEquippedDecorations(user.id);
}
```

### 3. 选择性加载

```typescript
// 如果不需要装饰品数据，不要加载
const user = await userRepository.findOne({
  where: { id },
  // 不包含 userDecorations relations
});
```

## 注意事项

1. **Relations 必须完整**
   ```typescript
   // ✅ 正确 - 同时加载 userDecorations 和 decoration
   relations: ["userDecorations", "userDecorations.decoration"]
   
   // ❌ 错误 - 只加载 userDecorations，decoration 为 undefined
   relations: ["userDecorations"]
   ```

2. **处理 null/undefined**
   ```typescript
   // ✅ 安全的访问
   const badge = user.equippedDecorations?.ACHIEVEMENT_BADGE;
   
   // ❌ 可能报错
   const badge = user.equippedDecorations.ACHIEVEMENT_BADGE;
   ```

3. **敏感信息清理**
   ```typescript
   // 使用 sanitizeUser 清理敏感字段
   const safeUser = sanitizeUser(processUserDecorations(user));
   ```

4. **装饰品过期检查**
   - 系统会自动过滤过期的装饰品
   - 成就勋章永久有效，不会过期

## 测试建议

### 单元测试

```typescript
describe('User Decorations Integration', () => {
  it('should load user decorations with user', async () => {
    const user = await userRepository.findOne({
      where: { id: 1 },
      relations: ["userDecorations", "userDecorations.decoration"]
    });
    
    expect(user.userDecorations).toBeDefined();
    expect(user.userDecorations.length).toBeGreaterThan(0);
  });

  it('should process user decorations correctly', () => {
    const user = {
      id: 1,
      userDecorations: [
        { isUsing: true, decoration: { type: 'ACHIEVEMENT_BADGE', ... } }
      ]
    };
    
    const processed = processUserDecorations(user);
    
    expect(processed.equippedDecorations).toBeDefined();
    expect(processed.equippedDecorations.ACHIEVEMENT_BADGE).toBeDefined();
    expect(processed.userDecorations).toBeUndefined();
  });
});
```

## 总结

✅ **完整集成** - 文章、评论、用户模块都已加载装饰品数据
✅ **自动处理** - 使用 `processUserDecorations()` 自动转换格式
✅ **前端友好** - `equippedDecorations` 格式便于前端使用
✅ **性能优化** - 使用 relations 预加载，避免 N+1 查询
✅ **类型安全** - 按装饰品类型分组，便于访问

成就勋章作为装饰品的一种，会自动包含在用户数据中，前端可以直接通过 `user.equippedDecorations.ACHIEVEMENT_BADGE` 访问。
