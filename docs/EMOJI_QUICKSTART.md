# 表情包系统 - 快速开始

## 🎯 5分钟快速上手

### 步骤 1: 创建数据库表 (1分钟)

执行以下 SQL 创建表情包相关的表：

```sql
-- 创建 emoji 表
CREATE TABLE `emoji` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `url` varchar(500) NOT NULL,
  `code` varchar(50) DEFAULT NULL,
  `type` enum('system','user') NOT NULL DEFAULT 'user',
  `userId` int DEFAULT NULL,
  `category` varchar(50) DEFAULT NULL,
  `tags` text,
  `useCount` int NOT NULL DEFAULT '0',
  `isPublic` tinyint(1) NOT NULL DEFAULT '1',
  `status` enum('active','inactive','deleted') NOT NULL DEFAULT 'active',
  `width` int DEFAULT NULL,
  `height` int DEFAULT NULL,
  `fileSize` int DEFAULT NULL,
  `mimeType` varchar(50) DEFAULT NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_emoji_code` (`code`),
  KEY `IDX_emoji_userId` (`userId`),
  CONSTRAINT `FK_emoji_user` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 创建 emoji_favorite 表
CREATE TABLE `emoji_favorite` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `emojiId` int NOT NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_emoji_favorite_user_emoji` (`userId`, `emojiId`),
  CONSTRAINT `FK_emoji_favorite_user` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_emoji_favorite_emoji` FOREIGN KEY (`emojiId`) REFERENCES `emoji` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 步骤 2: 创建上传目录 (30秒)

```bash
# 创建表情上传目录
mkdir -p uploads/emoji
```

### 步骤 3: 重启服务 (30秒)

```bash
# 重启开发服务器
npm run dev
```

### 步骤 4: 测试 API (3分钟)

#### 4.1 创建表情

```bash
curl -X POST http://localhost:3000/api/v1/emoji \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "开心",
    "url": "https://example.com/emoji/happy.png",
    "code": ":happy:",
    "category": "开心",
    "tags": "开心,笑脸,高兴",
    "isPublic": true
  }'
```

#### 4.2 上传表情图片

```bash
curl -X POST http://localhost:3000/api/v1/emoji/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/emoji.png" \
  -F "name=我的表情" \
  -F "code=:my-emoji:" \
  -F "category=自定义" \
  -F "isPublic=true"
```

#### 4.3 获取表情列表

```bash
curl -X GET "http://localhost:3000/api/v1/emoji?page=1&limit=20"
```

#### 4.4 添加到收藏

```bash
curl -X POST http://localhost:3000/api/v1/emoji/1/favorite \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🎨 前端集成

### React 示例

```jsx
import { useState } from 'react';
import axios from 'axios';

function EmojiUploader() {
  const [file, setFile] = useState(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');

  const handleUpload = async () => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', name);
    formData.append('category', category);
    formData.append('isPublic', 'true');

    try {
      const response = await axios.post('/api/v1/emoji/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      alert('上传成功！');
    } catch (error) {
      alert('上传失败：' + error.message);
    }
  };

  return (
    <div>
      <input type="file" onChange={(e) => setFile(e.target.files[0])} />
      <input 
        type="text" 
        placeholder="表情名称" 
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input 
        type="text" 
        placeholder="分类" 
        value={category}
        onChange={(e) => setCategory(e.target.value)}
      />
      <button onClick={handleUpload}>上传</button>
    </div>
  );
}
```

### Vue 示例

```vue
<template>
  <div>
    <input type="file" @change="handleFileChange" />
    <input v-model="name" placeholder="表情名称" />
    <input v-model="category" placeholder="分类" />
    <button @click="handleUpload">上传</button>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import axios from 'axios';

const file = ref(null);
const name = ref('');
const category = ref('');

const handleFileChange = (e) => {
  file.value = e.target.files[0];
};

const handleUpload = async () => {
  const formData = new FormData();
  formData.append('file', file.value);
  formData.append('name', name.value);
  formData.append('category', category.value);
  formData.append('isPublic', 'true');

  try {
    await axios.post('/api/v1/emoji/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    alert('上传成功！');
  } catch (error) {
    alert('上传失败：' + error.message);
  }
};
</script>
```

## 📱 表情选择器组件

### React 表情选择器

```jsx
import { useState, useEffect } from 'react';
import axios from 'axios';
import './EmojiPicker.css';

function EmojiPicker({ onSelect }) {
  const [emojis, setEmojis] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showFavorites, setShowFavorites] = useState(false);

  useEffect(() => {
    loadCategories();
    loadEmojis();
  }, [selectedCategory, showFavorites]);

  const loadCategories = async () => {
    const response = await axios.get('/api/v1/emoji/categories/list');
    setCategories(response.data);
  };

  const loadEmojis = async () => {
    const params = {
      page: 1,
      limit: 100,
      ...(selectedCategory !== 'all' && { category: selectedCategory }),
      ...(showFavorites && { onlyFavorites: true })
    };
    const response = await axios.get('/api/v1/emoji', { params });
    setEmojis(response.data.items);
  };

  const handleEmojiClick = async (emoji) => {
    // 增加使用次数
    await axios.post(`/api/v1/emoji/${emoji.id}/use`);
    // 回调
    onSelect(emoji);
  };

  const toggleFavorite = async (emoji, e) => {
    e.stopPropagation();
    if (emoji.isFavorite) {
      await axios.delete(`/api/v1/emoji/${emoji.id}/favorite`);
    } else {
      await axios.post(`/api/v1/emoji/${emoji.id}/favorite`);
    }
    loadEmojis();
  };

  return (
    <div className="emoji-picker">
      <div className="emoji-picker-header">
        <button onClick={() => setShowFavorites(!showFavorites)}>
          {showFavorites ? '全部' : '收藏'}
        </button>
      </div>
      
      <div className="emoji-categories">
        <button 
          className={selectedCategory === 'all' ? 'active' : ''}
          onClick={() => setSelectedCategory('all')}
        >
          全部
        </button>
        {categories.map(cat => (
          <button
            key={cat.category}
            className={selectedCategory === cat.category ? 'active' : ''}
            onClick={() => setSelectedCategory(cat.category)}
          >
            {cat.category} ({cat.count})
          </button>
        ))}
      </div>

      <div className="emoji-grid">
        {emojis.map(emoji => (
          <div 
            key={emoji.id} 
            className="emoji-item"
            onClick={() => handleEmojiClick(emoji)}
          >
            <img src={emoji.url} alt={emoji.name} title={emoji.name} />
            <button 
              className="favorite-btn"
              onClick={(e) => toggleFavorite(emoji, e)}
            >
              {emoji.isFavorite ? '❤️' : '🤍'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default EmojiPicker;
```

### CSS 样式

```css
/* EmojiPicker.css */
.emoji-picker {
  width: 400px;
  max-height: 500px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: white;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.emoji-picker-header {
  padding: 10px;
  border-bottom: 1px solid #eee;
}

.emoji-categories {
  display: flex;
  gap: 5px;
  padding: 10px;
  overflow-x: auto;
  border-bottom: 1px solid #eee;
}

.emoji-categories button {
  padding: 5px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  white-space: nowrap;
}

.emoji-categories button.active {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.emoji-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 10px;
  padding: 10px;
  max-height: 350px;
  overflow-y: auto;
}

.emoji-item {
  position: relative;
  width: 50px;
  height: 50px;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.2s;
}

.emoji-item:hover {
  background: #f0f0f0;
}

.emoji-item img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.favorite-btn {
  position: absolute;
  top: 0;
  right: 0;
  background: none;
  border: none;
  font-size: 12px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s;
}

.emoji-item:hover .favorite-btn {
  opacity: 1;
}
```

## 🔧 在评论中使用表情

### 评论输入框集成

```jsx
import { useState } from 'react';
import EmojiPicker from './EmojiPicker';

function CommentInput({ onSubmit }) {
  const [content, setContent] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const handleEmojiSelect = (emoji) => {
    // 插入表情代码
    setContent(content + emoji.code);
    setShowEmojiPicker(false);
  };

  const handleSubmit = () => {
    onSubmit(content);
    setContent('');
  };

  return (
    <div className="comment-input">
      <textarea 
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="输入评论..."
      />
      <div className="comment-actions">
        <button onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
          😊 表情
        </button>
        <button onClick={handleSubmit}>发送</button>
      </div>
      {showEmojiPicker && (
        <EmojiPicker onSelect={handleEmojiSelect} />
      )}
    </div>
  );
}
```

### 表情代码解析

```jsx
function parseEmojiCodes(content, emojis) {
  let parsed = content;
  
  emojis.forEach(emoji => {
    if (emoji.code) {
      const regex = new RegExp(emoji.code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      parsed = parsed.replace(
        regex, 
        `<img src="${emoji.url}" alt="${emoji.name}" class="inline-emoji" />`
      );
    }
  });
  
  return parsed;
}

function CommentDisplay({ content }) {
  const [emojis, setEmojis] = useState([]);
  const [parsedContent, setParsedContent] = useState('');

  useEffect(() => {
    loadEmojis();
  }, []);

  useEffect(() => {
    if (emojis.length > 0) {
      setParsedContent(parseEmojiCodes(content, emojis));
    }
  }, [content, emojis]);

  const loadEmojis = async () => {
    const response = await axios.get('/api/v1/emoji?limit=1000');
    setEmojis(response.data.items);
  };

  return (
    <div 
      className="comment-content"
      dangerouslySetInnerHTML={{ __html: parsedContent }}
    />
  );
}
```

## 📊 常用 API 示例

### 获取热门表情

```javascript
const response = await axios.get('/api/v1/emoji/popular/list?limit=20');
console.log('热门表情:', response.data);
```

### 搜索表情

```javascript
const response = await axios.get('/api/v1/emoji', {
  params: {
    keyword: '笑',
    page: 1,
    limit: 20
  }
});
console.log('搜索结果:', response.data);
```

### 按分类获取表情

```javascript
const response = await axios.get('/api/v1/emoji', {
  params: {
    category: '开心',
    page: 1,
    limit: 20
  }
});
console.log('开心表情:', response.data);
```

## 🎯 下一步

- 📖 阅读 [完整文档](../src/modules/emoji/README.md)
- 🗄️ 查看 [数据库设计](./EMOJI_DATABASE.md)
- 🔧 查看 [API 文档](http://localhost:3000/api)

## ❓ 常见问题

### Q: 上传的图片存储在哪里？

A: 默认存储在 `uploads/emoji/` 目录，可以配置为云存储。

### Q: 支持哪些图片格式？

A: 支持 JPEG、PNG、GIF、WebP 格式。

### Q: 图片大小限制是多少？

A: 默认最大 5MB，可以在配置中修改。

### Q: 如何批量导入表情？

A: 可以使用 SQL 批量插入或创建批量导入接口。

---

**需要帮助？** 查看 [完整文档](../src/modules/emoji/README.md) 或联系开发团队。
