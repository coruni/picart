# 收藏夹模块数据库迁移说明

## 新增表

### 1. favorite 表
```sql
CREATE TABLE `favorite` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL COMMENT '收藏夹名称',
  `description` text COMMENT '收藏夹描述',
  `cover` varchar(255) DEFAULT NULL COMMENT '封面图片',
  `isPublic` tinyint NOT NULL DEFAULT '0' COMMENT '是否公开',
  `sort` int NOT NULL DEFAULT '0' COMMENT '排序',
  `userId` int NOT NULL COMMENT '用户ID',
  `itemCount` int NOT NULL DEFAULT '0' COMMENT '收藏数量',
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `FK_favorite_user` (`userId`),
  CONSTRAINT `FK_favorite_user` FOREIGN KEY (`userId`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='收藏夹表';
```

### 2. favorite_item 表
```sql
CREATE TABLE `favorite_item` (
  `id` int NOT NULL AUTO_INCREMENT,
  `favoriteId` int NOT NULL COMMENT '收藏夹ID',
  `articleId` int DEFAULT NULL COMMENT '文章ID',
  `userId` int NOT NULL COMMENT '用户ID',
  `sort` int NOT NULL DEFAULT '0' COMMENT '在收藏夹中的排序',
  `note` text COMMENT '备注',
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '收藏时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_favorite_item_unique` (`favoriteId`,`articleId`),
  KEY `FK_favorite_item_favorite` (`favoriteId`),
  KEY `FK_favorite_item_article` (`articleId`),
  KEY `FK_favorite_item_user` (`userId`),
  CONSTRAINT `FK_favorite_item_favorite` FOREIGN KEY (`favoriteId`) REFERENCES `favorite` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_favorite_item_article` FOREIGN KEY (`articleId`) REFERENCES `article` (`id`) ON DELETE SET NULL,
  CONSTRAINT `FK_favorite_item_user` FOREIGN KEY (`userId`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='收藏夹项目表';
```

**注意**：
- `articleId` 字段允许为 NULL
- 删除文章时，收藏项的 `articleId` 会被设置为 NULL（ON DELETE SET NULL）
- 删除收藏夹时，会级联删除该收藏夹下的所有收藏项（ON DELETE CASCADE）

## 修改表

### user_config 表
新增字段：
```sql
ALTER TABLE `user_config` 
ADD COLUMN `hideFavorites` tinyint NOT NULL DEFAULT '0' COMMENT '是否隐藏收藏夹（true-隐藏，false-公开）' AFTER `enablePushNotification`;
```

## 新增配置项

在 `config` 表中新增以下配置：

```sql
INSERT INTO `config` (`key`, `value`, `description`, `type`, `group`, `public`) VALUES
('favorite_max_free_count', '6', '免费收藏夹最大数量', 'number', 'favorite', 1),
('favorite_create_cost', '10', '创建收藏夹所需积分（超出免费数量后）', 'number', 'favorite', 1);
```

## 索引说明

1. **favorite_item 表的唯一索引**：`(favoriteId, articleId)` 确保同一文章不会在同一收藏夹中重复添加
2. **级联删除**：删除收藏夹时，会自动删除该收藏夹下的所有收藏项
3. **SET NULL**：删除文章时，收藏项的 `articleId` 会被设置为 NULL，保留收藏记录但标记文章已删除

## 实体关系

### Article 实体
新增关系：
```typescript
@OneToMany(() => FavoriteItem, (favoriteItem) => favoriteItem.article)
favoriteItems: FavoriteItem[];
```

### FavoriteItem 实体
文章关系设置：
```typescript
@ManyToOne(() => Article, (article) => article.favoriteItems, {
  onDelete: 'SET NULL',
})
@JoinColumn({ name: 'articleId' })
article: Article;
```

## 查询文章时的收藏夹信息

查询文章详情时，会自动加载该文章所在的收藏夹信息：
- 只返回当前登录用户的收藏夹
- 未登录用户返回空数组
- 返回格式：
```json
{
  "favoriteItems": [
    {
      "favoriteId": 1,
      "favoriteName": "我的收藏",
      "note": "备注信息",
      "addedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

## 注意事项

1. 使用 TypeORM 的自动同步功能时，表会自动创建
2. 如果手动执行 SQL，请确保按顺序执行（先创建 favorite 表，再创建 favorite_item 表）
3. user_config 表的修改需要手动执行 ALTER TABLE 语句
4. 配置项会在应用启动时自动初始化，无需手动插入
