# 表情包模块

## 概述

表情包模块提供了完整的自定义表情包功能，支持用户上传、管理和使用自定义表情包。

## 功能特性

### ✅ 已实现功能

- **表情管理**
  - 创建表情
  - 上传表情图片
  - 更新表情信息
  - 删除表情（软删除）
  - 查询表情列表
  - 查询单个表情

- **表情类型**
  - 系统表情（管理员创建）
  - 用户表情（用户自定义）

- **表情包**
  - 创建、编辑和软删除表情包
  - 设置表情包公开或私有
  - 添加、移除表情并调整包内顺序
  - 公开表情包只能包含公开或系统表情

- **表情分类**
  - 自定义分类
  - 分类统计
  - 按分类筛选

- **表情收藏**
  - 添加到收藏
  - 取消收藏
  - 查看收藏列表

- **表情搜索**
  - 按名称搜索
  - 按标签搜索
  - 按代码搜索
  - 按分类筛选
  - 按类型筛选

- **表情统计**
  - 使用次数统计
  - 热门表情排行
  - 最近添加的表情

- **权限控制**
  - 公开/私有设置
  - 用户权限验证
  - 管理员权限

## 数据库设计

### emoji 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int | 主键 |
| name | varchar(100) | 表情名称 |
| url | varchar(500) | 表情图片URL |
| code | varchar(50) | 表情代码（如 :smile:） |
| type | enum | 表情类型（system/user） |
| userId | int | 创建者ID（系统表情为 null） |
| category | varchar(50) | 分类 |
| tags | text | 标签（逗号分隔） |
| useCount | int | 使用次数 |
| isPublic | boolean | 是否公开 |
| status | enum | 状态（active/inactive/deleted） |
| width | int | 宽度 |
| height | int | 高度 |
| fileSize | int | 文件大小 |
| mimeType | varchar(50) | 文件类型 |
| createdAt | datetime | 创建时间 |
| updatedAt | datetime | 更新时间 |

### emoji_favorite 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int | 主键 |
| userId | int | 用户ID |
| emojiId | int | 表情ID |
| createdAt | datetime | 创建时间 |

### `emoji_pack` 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int | 主键 |
| name | varchar(100) | 表情包名称 |
| description | text | 描述 |
| coverUrl | varchar(500) | 封面图片 URL |
| userId | int | 创建者 |
| isPublic | boolean | 是否公开 |
| status | enum | 状态（active/inactive/deleted） |
| createdAt / updatedAt | datetime | 创建/更新时间 |

### `emoji_pack_item` 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int | 主键 |
| packId | int | 表情包 ID |
| emojiId | int | 表情 ID |
| sort | int | 表情包内排序 |
| createdAt | datetime | 加入时间 |

`emoji_pack_item` 对 `(packId, emojiId)` 有唯一约束；单个表情可以加入多个表情包。
表情代码 `code` 有唯一索引（允许多条记录为空）。数据库升级脚本见
`docs/2026-11-14-emoji-pack.sql`；应用前请先处理脚本开头查询到的重复代码。

## API 接口

### 创建表情

```http
POST /api/v1/emoji
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "开心",
  "url": "https://example.com/emoji.png",
  "code": ":smile:",
  "category": "开心",
  "tags": "开心,笑脸,高兴",
  "isPublic": true
}
```

### 上传表情图片

```http
POST /api/v1/emoji/upload
Authorization: Bearer {token}
Content-Type: multipart/form-data

file: [图片文件]
name: 开心
code: :smile:
category: 开心
tags: 开心,笑脸,高兴
isPublic: true
```

### 获取表情列表

```http
GET /api/v1/emoji?page=1&limit=20&type=user&category=开心&keyword=笑
Authorization: Bearer {token} (可选)
```

### 获取单个表情

```http
GET /api/v1/emoji/:id
Authorization: Bearer {token} (可选)
```

### 更新表情

```http
PATCH /api/v1/emoji/:id
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "超级开心",
  "category": "开心",
  "isPublic": false
}
```

### 删除表情

```http
DELETE /api/v1/emoji/:id
Authorization: Bearer {token}
```

### 添加到收藏

```http
POST /api/v1/emoji/:id/favorite
Authorization: Bearer {token}
```

### 取消收藏

```http
DELETE /api/v1/emoji/:id/favorite
Authorization: Bearer {token}
```

### 获取收藏列表

```http
GET /api/v1/emoji/favorites/list?page=1&limit=20
Authorization: Bearer {token}
```

### 增加使用次数

```http
POST /api/v1/emoji/:id/use
Authorization: Bearer {token}
```

### 获取分类列表

```http
GET /api/v1/emoji/categories/list
```

### 获取热门表情

```http
GET /api/v1/emoji/popular/list?limit=20
```

### 获取最近添加的表情

```http
GET /api/v1/emoji/recent/list?limit=20
Authorization: Bearer {token}
```

### 表情包

```http
POST /api/v1/emoji/packs
GET /api/v1/emoji/packs?page=1&limit=10&keyword=开心
GET /api/v1/emoji/packs/:id
PATCH /api/v1/emoji/packs/:id
DELETE /api/v1/emoji/packs/:id
POST /api/v1/emoji/packs/:id/emojis
  { "emojiId": 1, "sort": 0 }
PATCH /api/v1/emoji/packs/:id/emojis/:emojiId
  { "sort": 1 }
DELETE /api/v1/emoji/packs/:id/emojis/:emojiId
```

创建、修改和管理包内表情需要登录；列表和详情对公开表情包开放，私有包仅所有者和管理员可见。
表情列表默认按分组返回，每页仍由 `page`、`limit` 控制，响应包含 `meta` 分页信息。

## 使用示例

### 在评论中使用表情

```typescript
import { EmojiService } from '../emoji/emoji.service';

@Injectable()
export class CommentService {
  constructor(
    private readonly emojiService: EmojiService,
  ) {}

  async create(createCommentDto: CreateCommentDto, user: User) {
    // 创建评论
    const comment = await this.commentRepository.save({
      ...createCommentDto,
      userId: user.id,
    });

    // 如果评论中包含表情代码，增加表情使用次数
    const emojiCodes = this.extractEmojiCodes(comment.content);
    for (const code of emojiCodes) {
      const emoji = await this.emojiRepository.findOne({ where: { code } });
      if (emoji) {
        await this.emojiService.incrementUseCount(emoji.id);
      }
    }

    return comment;
  }

  private extractEmojiCodes(content: string): string[] {
    const regex = /:([\w-]+):/g;
    const matches = content.match(regex);
    return matches || [];
  }
}
```

### 在消息中使用表情

```typescript
import { EmojiService } from '../emoji/emoji.service';

@Injectable()
export class MessageService {
  constructor(
    private readonly emojiService: EmojiService,
  ) {}

  async create(createMessageDto: CreateMessageDto, user: User) {
    // 创建消息
    const message = await this.messageRepository.save({
      ...createMessageDto,
      senderId: user.id,
    });

    // 处理表情使用统计
    const emojiCodes = this.extractEmojiCodes(message.content);
    for (const code of emojiCodes) {
      const emoji = await this.emojiRepository.findOne({ where: { code } });
      if (emoji) {
        await this.emojiService.incrementUseCount(emoji.id);
      }
    }

    return message;
  }
}
```

### 前端集成示例

#### React 示例

```jsx
import { useState, useEffect } from 'react';
import axios from 'axios';

function EmojiPicker({ onSelect }) {
  const [emojis, setEmojis] = useState([]);
  const [category, setCategory] = useState('all');
  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    loadEmojis();
  }, [category]);

  const loadEmojis = async () => {
    const params = category !== 'all' ? { category } : {};
    const response = await axios.get('/api/v1/emoji', { params });
    setEmojis(response.data.items);
  };

  const loadFavorites = async () => {
    const response = await axios.get('/api/v1/emoji/favorites/list');
    setFavorites(response.data.items);
  };

  const addToFavorites = async (emojiId) => {
    await axios.post(`/api/v1/emoji/${emojiId}/favorite`);
    loadFavorites();
  };

  const handleEmojiClick = async (emoji) => {
    // 增加使用次数
    await axios.post(`/api/v1/emoji/${emoji.id}/use`);
    // 回调选中的表情
    onSelect(emoji);
  };

  return (
    <div className="emoji-picker">
      <div className="categories">
        <button onClick={() => setCategory('all')}>全部</button>
        <button onClick={() => setCategory('开心')}>开心</button>
        <button onClick={() => setCategory('难过')}>难过</button>
        <button onClick={() => setCategory('搞笑')}>搞笑</button>
      </div>

      <div className="emoji-grid">
        {emojis.map(emoji => (
          <div key={emoji.id} className="emoji-item">
            <img 
              src={emoji.url} 
              alt={emoji.name}
              onClick={() => handleEmojiClick(emoji)}
            />
            <button onClick={() => addToFavorites(emoji.id)}>
              {emoji.isFavorite ? '❤️' : '🤍'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

#### Vue 示例

```vue
<template>
  <div class="emoji-picker">
    <div class="categories">
      <button @click="category = 'all'">全部</button>
      <button @click="category = '开心'">开心</button>
      <button @click="category = '难过'">难过</button>
      <button @click="category = '搞笑'">搞笑</button>
    </div>

    <div class="emoji-grid">
      <div 
        v-for="emoji in emojis" 
        :key="emoji.id" 
        class="emoji-item"
      >
        <img 
          :src="emoji.url" 
          :alt="emoji.name"
          @click="handleEmojiClick(emoji)"
        />
        <button @click="addToFavorites(emoji.id)">
          {{ emoji.isFavorite ? '❤️' : '🤍' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import axios from 'axios';

const emojis = ref([]);
const category = ref('all');

watch(category, () => {
  loadEmojis();
});

const loadEmojis = async () => {
  const params = category.value !== 'all' ? { category: category.value } : {};
  const response = await axios.get('/api/v1/emoji', { params });
  emojis.value = response.data.items;
};

const addToFavorites = async (emojiId) => {
  await axios.post(`/api/v1/emoji/${emojiId}/favorite`);
  loadEmojis();
};

const handleEmojiClick = async (emoji) => {
  await axios.post(`/api/v1/emoji/${emoji.id}/use`);
  emit('select', emoji);
};

loadEmojis();
</script>
```

## 表情代码解析

### 服务端解析

```typescript
export class EmojiParser {
  static async parseContent(
    content: string,
    emojiRepository: Repository<Emoji>,
  ): Promise<string> {
    const regex = /:([\w-]+):/g;
    let parsedContent = content;

    const matches = content.matchAll(regex);
    for (const match of matches) {
      const code = match[0];
      const emoji = await emojiRepository.findOne({ where: { code } });
      
      if (emoji) {
        parsedContent = parsedContent.replace(
          code,
          `<img src="${emoji.url}" alt="${emoji.name}" class="emoji" />`,
        );
      }
    }

    return parsedContent;
  }
}
```

### 前端解析

```javascript
function parseEmojiCodes(content, emojis) {
  const emojiMap = {};
  emojis.forEach(emoji => {
    if (emoji.code) {
      emojiMap[emoji.code] = emoji;
    }
  });

  return content.replace(/:([\w-]+):/g, (match) => {
    const emoji = emojiMap[match];
    if (emoji) {
      return `<img src="${emoji.url}" alt="${emoji.name}" class="emoji" />`;
    }
    return match;
  });
}
```

## 文件上传配置

### 支持的文件类型
- JPEG (.jpg, .jpeg)
- PNG (.png)
- GIF (.gif)
- WebP (.webp)

### 文件大小限制
- 最大 5MB

### 存储路径
- 本地存储：`./uploads/emoji/`
- 可配置为云存储（AWS S3、阿里云 OSS 等）

## 权限说明

### 用户权限
- 创建自己的表情
- 查看公开表情和自己的表情
- 更新自己的表情
- 删除自己的表情
- 收藏任何公开表情

### 管理员权限
- 创建系统表情
- 查看所有表情
- 更新任何表情
- 删除任何表情
- 管理表情分类

## 最佳实践

### 1. 表情命名
- 使用简洁明了的名称
- 使用中文或英文
- 避免使用特殊字符

### 2. 表情代码
- 使用英文小写
- 使用连字符分隔
- 例如：`:happy-face:`、`:sad-emoji:`

### 3. 表情分类
- 使用统一的分类名称
- 常用分类：开心、难过、搞笑、惊讶、生气等

### 4. 表情标签
- 使用逗号分隔
- 包含相关的关键词
- 便于搜索和发现

### 5. 图片优化
- 使用适当的图片尺寸（推荐 128x128 或 256x256）
- 压缩图片以减小文件大小
- 使用 WebP 格式以获得更好的压缩率

## 常见问题

### Q: 如何批量导入表情？

A: 可以创建一个批量导入接口：

```typescript
@Post('batch-import')
async batchImport(@Body() emojis: CreateEmojiDto[], @Req() req: any) {
  const results = [];
  for (const emoji of emojis) {
    const result = await this.emojiService.create(emoji, req.user);
    results.push(result);
  }
  return results;
}
```

### Q: 如何实现表情包分组？

A: 可以添加一个 `group` 字段到 emoji 表，然后按分组查询。

### Q: 如何实现动态表情（GIF）？

A: 系统已支持 GIF 格式，只需上传 GIF 文件即可。

### Q: 如何限制用户上传的表情数量？

A: 在创建表情时添加数量检查：

```typescript
const userEmojiCount = await this.emojiRepository.count({
  where: { userId: user.id, status: 'active' },
});

if (userEmojiCount >= 100) {
  throw new BadRequestException('已达到表情数量上限');
}
```

## 更新日志

### v1.0.0 (2024-01-14)

- ✅ 实现表情 CRUD
- ✅ 实现表情上传
- ✅ 实现表情收藏
- ✅ 实现表情搜索
- ✅ 实现表情分类
- ✅ 实现使用统计
- ✅ 实现权限控制

## 技术支持

如有问题，请联系开发团队或提交 Issue。
