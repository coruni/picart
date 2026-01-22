# 文章收藏功能总结

## 功能概述

已完成独立的文章收藏功能，与"收藏夹（合集）"功能分离。

## 核心功能

### 1. 收藏文章
- ✅ 一键收藏文章
- ✅ 防止重复收藏
- ✅ 自动维护收藏计数
- ✅ 触发双向奖励事件

### 2. 取消收藏
- ✅ 删除收藏记录
- ✅ 自动减少收藏计数

### 3. 检查收藏状态
- ✅ 查询是否已收藏
- ✅ 返回收藏时间

### 4. 收藏列表
- ✅ 查询自己的收藏
- ✅ 查询他人的收藏
- ✅ 隐私控制（hideFavorites）
- ✅ 分页支持

## API 接口

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | `/article/:id/favorite` | 收藏文章 | 需要登录 |
| DELETE | `/article/:id/favorite` | 取消收藏 | 需要登录 |
| GET | `/article/:id/favorite/status` | 检查收藏状态 | 需要登录 |
| GET | `/article/favorited/list` | 获取收藏列表 | 可选登录 |

## 数据库设计

### ArticleFavorite 表
```sql
CREATE TABLE `article_favorite` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL COMMENT '用户ID',
  `articleId` int NOT NULL COMMENT '文章ID',
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_userId_articleId` (`userId`, `articleId`),
  CONSTRAINT `FK_article_favorite_user` FOREIGN KEY (`userId`) 
    REFERENCES `user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_article_favorite_article` FOREIGN KEY (`articleId`) 
    REFERENCES `article` (`id`) ON DELETE CASCADE
);
```

### Article 表新增字段
```sql
ALTER TABLE `article` 
ADD COLUMN `favoriteCount` int NOT NULL DEFAULT 0 COMMENT '收藏数';
```

## 事件系统

### article.favorited
- **触发时机**：用户收藏文章
- **奖励对象**：收藏者
- **用途**：积分奖励、活动进度

### article.receivedFavorite
- **触发时机**：文章被收藏
- **奖励对象**：文章作者
- **用途**：积分奖励、经验值、成就、通知
- **特殊规则**：自己收藏自己的文章不触发

## 隐私控制

### UserConfig.hideFavorites
- `false`（默认）：公开收藏列表
- `true`：隐藏收藏列表

### 访问规则
- 用户自己：始终可见
- 其他用户：根据 `hideFavorites` 设置
- 隐藏时：返回空列表（不报错）

## 使用场景

### 用户端
```
用户浏览文章 → 点击收藏按钮 → 文章被收藏
                ↓
        收藏者获得积分
                ↓
        作者获得积分+经验
                ↓
        作者收到通知
```

### 个人主页
```
访问用户主页 → 查看收藏列表
                ↓
        检查隐私设置
                ↓
    允许：显示收藏列表
    禁止：显示空列表
```

## 与收藏夹的区别

| 特性 | 收藏 | 收藏夹（合集） |
|------|------|---------------|
| 用途 | 个人收藏 | 文章集合 |
| 创建者 | 任何用户 | 通常是作者 |
| 可见性 | 可控制 | 可公开可私有 |
| 排序 | 按时间 | 可自定义 |
| 备注 | 无 | 支持 |
| 数据表 | `article_favorite` | `favorite` + `favorite_item` |

## 待实现功能

### 积分系统集成
- [ ] 监听 `article.favorited` 事件
- [ ] 监听 `article.receivedFavorite` 事件
- [ ] 添加积分规则到种子文件

### 等级系统集成
- [ ] 监听 `article.receivedFavorite` 事件
- [ ] 文章被收藏增加经验值

### 成就系统集成
- [ ] 监听 `article.receivedFavorite` 事件
- [ ] 创建收藏相关成就（首次被收藏、100次收藏等）

### 通知系统集成
- [ ] 监听 `article.receivedFavorite` 事件
- [ ] 发送收藏通知给作者

### 装饰品系统集成
- [ ] 监听 `article.favorited` 事件
- [ ] 更新收藏活动进度

## 前端集成建议

### 收藏按钮
```jsx
<button onClick={() => toggleFavorite(articleId)}>
  {isFavorited ? '⭐ 已收藏' : '☆ 收藏'}
</button>
```

### 收藏列表
```jsx
// 我的收藏
<FavoriteList userId={currentUser.id} />

// 查看他人收藏
<FavoriteList userId={targetUser.id} />
```

### 隐私设置
```jsx
<Switch
  checked={hideFavorites}
  onChange={(value) => updateConfig({ hideFavorites: value })}
  label="隐藏我的收藏列表"
/>
```

## 测试要点

- [x] 收藏文章成功
- [x] 防止重复收藏
- [x] 取消收藏成功
- [x] 收藏计数正确
- [x] 事件触发正确
- [x] 隐私控制生效
- [x] 查询自己的收藏
- [x] 查询他人的收藏
- [x] 级联删除正常

## 性能优化

- ✅ 使用唯一索引防止重复
- ✅ 使用 increment/decrement 更新计数
- ✅ 分页查询避免大数据量
- ✅ 级联删除自动清理

## 安全性

- ✅ 登录验证
- ✅ 权限检查
- ✅ 隐私控制
- ✅ SQL 注入防护（TypeORM）
- ✅ 级联删除保护
