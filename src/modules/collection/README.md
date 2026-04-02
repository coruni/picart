# 收藏夹模块

## 功能概述

收藏夹模块允许用户创建多个收藏夹，将喜欢的文章收藏到不同的收藏夹中，方便管理和查看。

## 主要功能

### 1. 收藏夹管理
- ✅ 创建收藏夹（默认免费6个，超出需要积分）
- ✅ 查看收藏夹列表
- ✅ 查看收藏夹详情
- ✅ 更新收藏夹信息
- ✅ 删除收藏夹

### 2. 收藏管理
- ✅ 添加文章到收藏夹
- ✅ 从收藏夹移除文章
- ✅ 查看收藏夹中的文章列表（带上一篇/下一篇导航）
- ✅ 检查文章是否在收藏夹中
- ✅ 查看文章所在的收藏夹信息
- ✅ 查询文章详情时自动返回当前用户的收藏夹信息

### 3. 权限控制
- ✅ 收藏夹可设置为公开或私有
- ✅ 私有收藏夹仅所有者可见
- ✅ 公开收藏夹所有人可见
- ✅ 用户可在个人配置中设置隐藏所有收藏夹
- ✅ 隐藏收藏夹后，其他用户无法查看该用户的任何收藏夹（包括公开的）

## 配置项

### 系统配置

在系统配置中可以设置以下参数：

| 配置键 | 说明 | 默认值 |
|--------|------|--------|
| `favorite_max_free_count` | 免费收藏夹最大数量 | 6 |
| `favorite_create_cost` | 创建收藏夹所需积分（超出免费数量后） | 10 |

### 用户配置

在用户配置（UserConfig）中可以设置：

| 字段 | 说明 | 默认值 |
|------|------|--------|
| `hideFavorites` | 是否隐藏收藏夹 | false |

当用户设置 `hideFavorites = true` 时：
- 其他用户无法查看该用户的收藏夹列表
- 其他用户无法查看该用户的任何收藏夹详情（包括公开的）
- 用户自己仍然可以正常查看和管理自己的收藏夹

## API 接口

### 收藏夹管理

#### 创建收藏夹
```
POST /favorite
Authorization: Bearer {token}

Body:
{
  "name": "我的收藏",
  "description": "收藏夹描述",
  "cover": "封面图片URL",
  "isPublic": false,
  "sort": 0
}
```

#### 获取收藏夹列表
```
GET /favorite?page=1&limit=10&userId=1
```
- 不需要登录，但登录后可以查看自己的私有收藏夹
- 查询其他用户时只能看到公开的收藏夹

#### 获取收藏夹详情
```
GET /favorite/:id
```

#### 更新收藏夹
```
PATCH /favorite/:id
Authorization: Bearer {token}

Body:
{
  "name": "新名称",
  "description": "新描述",
  "isPublic": true
}
```

#### 删除收藏夹
```
DELETE /favorite/:id
Authorization: Bearer {token}
```

### 收藏管理

#### 添加文章到收藏夹
```
POST /favorite/add
Authorization: Bearer {token}

Body:
{
  "favoriteId": 1,
  "articleId": 100,
  "note": "备注信息"
}
```

#### 从收藏夹移除文章
```
DELETE /favorite/:favoriteId/article/:articleId
Authorization: Bearer {token}
```

#### 获取收藏夹中的文章列表
```
GET /favorite/:id/items?page=1&limit=10
```
- 返回的每个文章项包含上一篇和下一篇的信息
- 不需要登录，但私有收藏夹需要所有者权限

#### 检查文章是否在收藏夹中
```
GET /favorite/check/:articleId
Authorization: Bearer {token}
```

返回：
```json
{
  "inFavorites": true,
  "favorites": [
    {
      "id": 1,
      "name": "我的收藏"
    }
  ]
}
```

#### 获取文章所在的收藏夹信息
```
GET /favorite/article/:articleId/info
Authorization: Bearer {token}
```

返回：
```json
[
  {
    "favoriteId": 1,
    "favoriteName": "我的收藏",
    "note": "备注信息",
    "addedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

## 与文章模块的集成

### 查询文章时返回收藏夹信息

当查询文章详情时（`GET /article/:id`），会自动返回该文章所在的收藏夹信息：

```json
{
  "id": 1,
  "title": "文章标题",
  "content": "文章内容",
  "favoriteItems": [
    {
      "favoriteId": 1,
      "favoriteName": "我的作品集",
      "isPublic": true,
      "userId": 1,
      "userName": "作者名称",
      "note": "备注信息",
      "addedAt": "2024-01-01T00:00:00.000Z"
    },
    {
      "favoriteId": 2,
      "favoriteName": "技术文章合集",
      "isPublic": false,
      "userId": 1,
      "userName": "作者名称",
      "note": "私有收藏夹的备注",
      "addedAt": "2024-01-02T00:00:00.000Z"
    }
  ]
}
```

**显示规则**：
- **未登录用户**：只能看到公开的收藏夹
- **登录用户（非作者）**：只能看到公开的收藏夹
- **登录用户（文章作者）**：可以看到所有收藏夹（公开+私有），包括备注信息
- 通过关系查询自动加载，无需额外API调用

**字段说明**：
- `favoriteId`: 收藏夹ID
- `favoriteName`: 收藏夹名称
- `isPublic`: 是否公开
- `userId`: 收藏夹所有者ID
- `userName`: 收藏夹所有者用户名
- `note`: 备注（仅收藏夹所有者可见）
- `addedAt`: 添加时间

## 数据库表结构

### favorite 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | int | 主键 |
| name | varchar(100) | 收藏夹名称 |
| description | text | 收藏夹描述 |
| cover | varchar | 封面图片 |
| isPublic | boolean | 是否公开 |
| sort | int | 排序 |
| userId | int | 用户ID |
| itemCount | int | 收藏数量 |
| createdAt | datetime | 创建时间 |
| updatedAt | datetime | 更新时间 |

### favorite_item 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | int | 主键 |
| favoriteId | int | 收藏夹ID |
| articleId | int (nullable) | 文章ID（文章删除后为NULL） |
| userId | int | 用户ID |
| sort | int | 在收藏夹中的排序 |
| note | text | 备注 |
| createdAt | datetime | 收藏时间 |

**外键约束**：
- `favoriteId` → `favorite.id` (ON DELETE CASCADE)
- `articleId` → `article.id` (ON DELETE SET NULL)
- `userId` → `user.id`

## 权限逻辑

### 添加文章到收藏夹
**重要限制**：只有文章作者才能将文章加入自己的收藏夹
- 用户只能将自己创建的文章加入收藏夹
- 不能将他人的文章加入自己的收藏夹
- 这是为了将收藏夹作为"作品集/合集"使用

### 查看收藏夹列表
1. 查看自己的收藏夹：可以看到所有收藏夹（公开+私有）
2. 查看他人的收藏夹：
   - 如果目标用户设置了 `hideFavorites = true`，返回403错误
   - 否则只能看到公开的收藏夹

### 查看收藏夹详情
1. 查看自己的收藏夹：可以查看任何收藏夹
2. 查看他人的收藏夹：
   - 如果收藏夹是私有的，返回403错误
   - 如果目标用户设置了 `hideFavorites = true`，返回403错误
   - 否则可以查看

### 管理收藏夹
只有收藏夹所有者可以：
- 更新收藏夹信息
- 删除收藏夹
- 添加/移除文章

1. **个人作品集管理**：作者可以创建多个收藏夹，将自己的文章按主题分类整理成作品集/合集
2. **公开展示**：作者可以将收藏夹设为公开，展示自己的作品集给其他用户
3. **隐私保护**：作者可以在配置中隐藏所有收藏夹，保护隐私
4. **文章导航**：在收藏夹中浏览文章时，可以快速跳转到上一篇/下一篇
5. **积分消费**：超出免费数量的收藏夹需要消耗积分创建，增加用户粘性
6. **作品集展示**：查看文章时可以看到该文章所在的公开收藏夹，了解作者的其他作品

## 注意事项

1. 删除收藏夹会级联删除其中的所有收藏项
2. **删除文章时，收藏项不会被删除，但 `articleId` 会被设置为 NULL**
3. **只有文章作者才能将文章加入自己的收藏夹**（作为作品集/合集使用）
4. 收藏夹中的文章按sort字段排序，新添加的文章会自动排在最后
5. 私有收藏夹只有所有者可以查看和管理
6. 创建收藏夹时会自动检查用户积分是否足够
7. 用户设置隐藏收藏夹后，所有收藏夹（包括公开的）都无法被其他用户查看
8. 隐藏收藏夹的设置在用户配置（UserConfig）中，需要通过用户配置接口修改
9. 查询文章详情时会自动返回该文章所在的收藏夹信息（公开的对所有人可见）
10. 未登录用户也可以看到文章所在的公开收藏夹
