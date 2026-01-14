# 表情包系统 - 数据库设计

## 数据库表

### 1. emoji 表

表情包主表，存储所有表情信息。

```sql
CREATE TABLE `emoji` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `name` varchar(100) NOT NULL COMMENT '表情名称',
  `url` varchar(500) NOT NULL COMMENT '表情图片URL',
  `code` varchar(50) DEFAULT NULL COMMENT '表情代码，如 :smile:',
  `type` enum('system','user') NOT NULL DEFAULT 'user' COMMENT '表情类型：system-系统表情，user-用户表情',
  `userId` int DEFAULT NULL COMMENT '创建者ID，系统表情为NULL',
  `category` varchar(50) DEFAULT NULL COMMENT '分类：开心、难过、搞笑等',
  `tags` text COMMENT '标签，逗号分隔',
  `useCount` int NOT NULL DEFAULT '0' COMMENT '使用次数',
  `isPublic` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否公开',
  `status` enum('active','inactive','deleted') NOT NULL DEFAULT 'active' COMMENT '状态',
  `width` int DEFAULT NULL COMMENT '宽度（像素）',
  `height` int DEFAULT NULL COMMENT '高度（像素）',
  `fileSize` int DEFAULT NULL COMMENT '文件大小（字节）',
  `mimeType` varchar(50) DEFAULT NULL COMMENT '文件类型',
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_emoji_code` (`code`),
  KEY `IDX_emoji_type` (`type`),
  KEY `IDX_emoji_userId` (`userId`),
  KEY `IDX_emoji_category` (`category`),
  KEY `IDX_emoji_status` (`status`),
  KEY `IDX_emoji_isPublic` (`isPublic`),
  KEY `IDX_emoji_useCount` (`useCount`),
  KEY `IDX_emoji_createdAt` (`createdAt`),
  CONSTRAINT `FK_emoji_user` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='表情包表';
```

### 2. emoji_favorite 表

表情收藏表，记录用户收藏的表情。

```sql
CREATE TABLE `emoji_favorite` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `userId` int NOT NULL COMMENT '用户ID',
  `emojiId` int NOT NULL COMMENT '表情ID',
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_emoji_favorite_user_emoji` (`userId`, `emojiId`),
  KEY `IDX_emoji_favorite_userId` (`userId`),
  KEY `IDX_emoji_favorite_emojiId` (`emojiId`),
  CONSTRAINT `FK_emoji_favorite_user` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_emoji_favorite_emoji` FOREIGN KEY (`emojiId`) REFERENCES `emoji` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='表情收藏表';
```

## 字段说明

### emoji 表字段

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| id | int | 是 | 自增 | 主键ID |
| name | varchar(100) | 是 | - | 表情名称 |
| url | varchar(500) | 是 | - | 表情图片URL |
| code | varchar(50) | 否 | NULL | 表情代码，如 :smile: |
| type | enum | 是 | user | 表情类型：system-系统表情，user-用户表情 |
| userId | int | 否 | NULL | 创建者ID，系统表情为NULL |
| category | varchar(50) | 否 | NULL | 分类：开心、难过、搞笑等 |
| tags | text | 否 | NULL | 标签，逗号分隔 |
| useCount | int | 是 | 0 | 使用次数 |
| isPublic | boolean | 是 | true | 是否公开 |
| status | enum | 是 | active | 状态：active-激活，inactive-未激活，deleted-已删除 |
| width | int | 否 | NULL | 宽度（像素） |
| height | int | 否 | NULL | 高度（像素） |
| fileSize | int | 否 | NULL | 文件大小（字节） |
| mimeType | varchar(50) | 否 | NULL | 文件类型 |
| createdAt | datetime | 是 | 当前时间 | 创建时间 |
| updatedAt | datetime | 是 | 当前时间 | 更新时间 |

### emoji_favorite 表字段

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| id | int | 是 | 自增 | 主键ID |
| userId | int | 是 | - | 用户ID |
| emojiId | int | 是 | - | 表情ID |
| createdAt | datetime | 是 | 当前时间 | 创建时间 |

## 索引说明

### emoji 表索引

1. **PRIMARY KEY** (`id`) - 主键索引
2. **UNIQUE KEY** (`code`) - 表情代码唯一索引
3. **KEY** (`type`) - 表情类型索引，用于按类型筛选
4. **KEY** (`userId`) - 用户ID索引，用于查询用户的表情
5. **KEY** (`category`) - 分类索引，用于按分类筛选
6. **KEY** (`status`) - 状态索引，用于筛选激活的表情
7. **KEY** (`isPublic`) - 公开性索引，用于筛选公开表情
8. **KEY** (`useCount`) - 使用次数索引，用于热门排序
9. **KEY** (`createdAt`) - 创建时间索引，用于最新排序

### emoji_favorite 表索引

1. **PRIMARY KEY** (`id`) - 主键索引
2. **UNIQUE KEY** (`userId`, `emojiId`) - 用户和表情的联合唯一索引，防止重复收藏
3. **KEY** (`userId`) - 用户ID索引，用于查询用户的收藏
4. **KEY** (`emojiId`) - 表情ID索引，用于查询表情的收藏数

## 外键约束

### emoji 表

- `FK_emoji_user`: `userId` → `user.id` (ON DELETE CASCADE)
  - 当用户被删除时，该用户创建的表情也会被删除

### emoji_favorite 表

- `FK_emoji_favorite_user`: `userId` → `user.id` (ON DELETE CASCADE)
  - 当用户被删除时，该用户的收藏记录也会被删除

- `FK_emoji_favorite_emoji`: `emojiId` → `emoji.id` (ON DELETE CASCADE)
  - 当表情被删除时，该表情的收藏记录也会被删除

## 数据示例

### emoji 表示例数据

```sql
-- 系统表情
INSERT INTO `emoji` (`name`, `url`, `code`, `type`, `userId`, `category`, `tags`, `isPublic`, `status`)
VALUES
('开心', 'https://example.com/emoji/happy.png', ':happy:', 'system', NULL, '开心', '开心,笑脸,高兴', 1, 'active'),
('难过', 'https://example.com/emoji/sad.png', ':sad:', 'system', NULL, '难过', '难过,伤心,哭泣', 1, 'active'),
('搞笑', 'https://example.com/emoji/funny.png', ':funny:', 'system', NULL, '搞笑', '搞笑,有趣,好笑', 1, 'active');

-- 用户表情
INSERT INTO `emoji` (`name`, `url`, `code`, `type`, `userId`, `category`, `tags`, `isPublic`, `status`)
VALUES
('我的表情', 'https://example.com/emoji/my-emoji.png', ':my-emoji:', 'user', 1, '自定义', '自定义,个性', 1, 'active');
```

### emoji_favorite 表示例数据

```sql
-- 用户收藏表情
INSERT INTO `emoji_favorite` (`userId`, `emojiId`)
VALUES
(1, 1),  -- 用户1收藏表情1
(1, 2),  -- 用户1收藏表情2
(2, 1);  -- 用户2收藏表情1
```

## 查询示例

### 1. 查询所有公开表情

```sql
SELECT * FROM `emoji`
WHERE `status` = 'active' AND `isPublic` = 1
ORDER BY `useCount` DESC, `createdAt` DESC;
```

### 2. 查询用户的表情

```sql
SELECT * FROM `emoji`
WHERE `userId` = 1 AND `status` = 'active'
ORDER BY `createdAt` DESC;
```

### 3. 按分类查询表情

```sql
SELECT * FROM `emoji`
WHERE `category` = '开心' AND `status` = 'active' AND `isPublic` = 1
ORDER BY `useCount` DESC;
```

### 4. 搜索表情

```sql
SELECT * FROM `emoji`
WHERE `status` = 'active' AND `isPublic` = 1
  AND (`name` LIKE '%笑%' OR `tags` LIKE '%笑%' OR `code` LIKE '%笑%')
ORDER BY `useCount` DESC;
```

### 5. 查询用户收藏的表情

```sql
SELECT e.* FROM `emoji` e
INNER JOIN `emoji_favorite` ef ON e.id = ef.emojiId
WHERE ef.userId = 1 AND e.status = 'active'
ORDER BY ef.createdAt DESC;
```

### 6. 查询热门表情

```sql
SELECT * FROM `emoji`
WHERE `status` = 'active' AND `isPublic` = 1
ORDER BY `useCount` DESC
LIMIT 20;
```

### 7. 查询表情分类统计

```sql
SELECT `category`, COUNT(*) as `count`
FROM `emoji`
WHERE `status` = 'active' AND `category` IS NOT NULL
GROUP BY `category`
ORDER BY `count` DESC;
```

### 8. 查询表情收藏数

```sql
SELECT e.*, COUNT(ef.id) as `favoriteCount`
FROM `emoji` e
LEFT JOIN `emoji_favorite` ef ON e.id = ef.emojiId
WHERE e.status = 'active'
GROUP BY e.id
ORDER BY `favoriteCount` DESC;
```

## 性能优化建议

### 1. 索引优化

- 已为常用查询字段添加索引
- 使用联合索引优化多条件查询
- 定期分析和优化索引

### 2. 查询优化

- 使用分页查询，避免一次性加载大量数据
- 使用 JOIN 代替子查询
- 避免使用 SELECT *，只查询需要的字段

### 3. 缓存策略

- 缓存热门表情列表
- 缓存表情分类列表
- 缓存用户收藏列表

### 4. 数据归档

- 定期归档已删除的表情
- 清理长期未使用的表情

## 数据迁移

### 使用 TypeORM 迁移

```bash
# 生成迁移文件
npm run migration:generate -- -n CreateEmojiTables

# 运行迁移
npm run migration:run

# 回滚迁移
npm run migration:revert
```

### 手动创建表

如果不使用迁移，可以直接执行上面的 SQL 语句创建表。

## 数据备份

### 备份表情数据

```bash
# 备份 emoji 表
mysqldump -u username -p database_name emoji > emoji_backup.sql

# 备份 emoji_favorite 表
mysqldump -u username -p database_name emoji_favorite > emoji_favorite_backup.sql
```

### 恢复表情数据

```bash
# 恢复 emoji 表
mysql -u username -p database_name < emoji_backup.sql

# 恢复 emoji_favorite 表
mysql -u username -p database_name < emoji_favorite_backup.sql
```

## 常见问题

### Q: 如何批量导入表情？

A: 可以使用 SQL 批量插入：

```sql
INSERT INTO `emoji` (`name`, `url`, `code`, `type`, `category`, `tags`, `isPublic`)
VALUES
('表情1', 'url1', ':emoji1:', 'system', '开心', '标签1', 1),
('表情2', 'url2', ':emoji2:', 'system', '开心', '标签2', 1),
('表情3', 'url3', ':emoji3:', 'system', '难过', '标签3', 1);
```

### Q: 如何清理未使用的表情？

A: 可以查询并删除长期未使用的表情：

```sql
-- 查询30天内未使用的表情
SELECT * FROM `emoji`
WHERE `useCount` = 0 AND `createdAt` < DATE_SUB(NOW(), INTERVAL 30 DAY);

-- 删除（软删除）
UPDATE `emoji`
SET `status` = 'deleted'
WHERE `useCount` = 0 AND `createdAt` < DATE_SUB(NOW(), INTERVAL 30 DAY);
```

### Q: 如何统计用户的表情使用情况？

A: 可以通过 useCount 字段统计：

```sql
SELECT u.username, SUM(e.useCount) as totalUseCount
FROM `user` u
INNER JOIN `emoji` e ON u.id = e.userId
WHERE e.status = 'active'
GROUP BY u.id
ORDER BY totalUseCount DESC;
```

## 更新日志

### v1.0.0 (2024-01-14)

- ✅ 创建 emoji 表
- ✅ 创建 emoji_favorite 表
- ✅ 添加索引和外键约束
- ✅ 提供示例数据和查询

---

**维护者**: 开发团队  
**最后更新**: 2024-01-14
