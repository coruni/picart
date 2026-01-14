# 评论图片功能使用指南

## 概述

评论系统现已支持上传图片，用户可以在评论中添加最多 9 张图片。

## 功能特性

- ✅ 支持评论中添加图片
- ✅ 最多支持 9 张图片
- ✅ 使用现有的 upload 模块上传
- ✅ 图片 URL 存储在评论中
- ✅ 支持更新评论图片

## 数据库变更

### comment 表新增字段

```sql
ALTER TABLE `comment` 
ADD COLUMN `images` LONGTEXT NULL COMMENT '评论图片列表（JSON字符串）' AFTER `content`;
```

**字段说明：**
- 类型：`LONGTEXT`
- 存储格式：JSON 字符串数组
- 示例：`'["https://example.com/image1.jpg", "https://example.com/image2.jpg"]'`
- 可为空：是

**TypeORM 实体定义：**

```typescript
@Column({ type: "longtext", nullable: true, comment: "评论图片列表（JSON字符串）" })
images: string;
```

**注意：** 虽然数据库字段是 `longtext`，但在应用层会自动进行 JSON 序列化和反序列化。

## 使用流程

### 步骤 1: 上传图片

使用现有的上传接口上传图片：

```bash
curl -X POST http://localhost:3000/api/v1/upload/file \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "files=@/path/to/image1.jpg" \
  -F "files=@/path/to/image2.jpg"
```

**响应示例：**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "filename": "abc123.jpg",
      "url": "https://example.com/uploads/abc123.jpg",
      "mimetype": "image/jpeg",
      "size": 102400
    },
    {
      "id": 2,
      "filename": "def456.jpg",
      "url": "https://example.com/uploads/def456.jpg",
      "mimetype": "image/jpeg",
      "size": 204800
    }
  ]
}
```

### 步骤 2: 创建带图片的评论

使用获得的图片 URL 创建评论：

```bash
curl -X POST http://localhost:3000/api/v1/comment \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "这是一条带图片的评论",
    "articleId": 1,
    "images": [
      "https://example.com/uploads/abc123.jpg",
      "https://example.com/uploads/def456.jpg"
    ]
  }'
```

### 步骤 3: 更新评论图片

```bash
curl -X PATCH http://localhost:3000/api/v1/comment/1 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "images": [
      "https://example.com/uploads/abc123.jpg",
      "https://example.com/uploads/def456.jpg",
      "https://example.com/uploads/ghi789.jpg"
    ]
  }'
```

## 前端集成示例

### React 示例

```jsx
import { useState } from 'react';
import axios from 'axios';

function CommentWithImages() {
  const [content, setContent] = useState('');
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);

  // 上传图片
  const handleImageUpload = async (files) => {
    if (images.length + files.length > 9) {
      alert('最多只能上传9张图片');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    
    Array.from(files).forEach(file => {
      formData.append('files', file);
    });

    try {
      const response = await axios.post('/api/v1/upload/file', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const uploadedUrls = response.data.data.map(item => item.url);
      setImages([...images, ...uploadedUrls]);
    } catch (error) {
      alert('图片上传失败：' + error.message);
    } finally {
      setUploading(false);
    }
  };

  // 删除图片
  const handleRemoveImage = (index) => {
    setImages(images.filter((_, i) => i !== index));
  };

  // 提交评论
  const handleSubmit = async () => {
    if (!content.trim()) {
      alert('请输入评论内容');
      return;
    }

    try {
      await axios.post('/api/v1/comment', {
        content,
        articleId: 1, // 替换为实际的文章ID
        images
      }, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      alert('评论发布成功！');
      setContent('');
      setImages([]);
    } catch (error) {
      alert('评论发布失败：' + error.message);
    }
  };

  return (
    <div className="comment-form">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="输入评论内容..."
        rows={4}
      />

      {/* 图片预览 */}
      <div className="image-preview">
        {images.map((url, index) => (
          <div key={index} className="image-item">
            <img src={url} alt={`预览${index + 1}`} />
            <button onClick={() => handleRemoveImage(index)}>删除</button>
          </div>
        ))}
      </div>

      {/* 上传按钮 */}
      <div className="actions">
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => handleImageUpload(e.target.files)}
          disabled={uploading || images.length >= 9}
          style={{ display: 'none' }}
          id="image-upload"
        />
        <label htmlFor="image-upload" className="upload-btn">
          {uploading ? '上传中...' : `📷 添加图片 (${images.length}/9)`}
        </label>
        <button onClick={handleSubmit} disabled={uploading}>
          发布评论
        </button>
      </div>
    </div>
  );
}

export default CommentWithImages;
```

### Vue 示例

```vue
<template>
  <div class="comment-form">
    <textarea
      v-model="content"
      placeholder="输入评论内容..."
      rows="4"
    />

    <!-- 图片预览 -->
    <div class="image-preview">
      <div v-for="(url, index) in images" :key="index" class="image-item">
        <img :src="url" :alt="`预览${index + 1}`" />
        <button @click="removeImage(index)">删除</button>
      </div>
    </div>

    <!-- 上传按钮 -->
    <div class="actions">
      <input
        type="file"
        accept="image/*"
        multiple
        @change="handleImageUpload"
        :disabled="uploading || images.length >= 9"
        style="display: none"
        ref="fileInput"
      />
      <button @click="$refs.fileInput.click()" :disabled="uploading || images.length >= 9">
        {{ uploading ? '上传中...' : `📷 添加图片 (${images.length}/9)` }}
      </button>
      <button @click="handleSubmit" :disabled="uploading">
        发布评论
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import axios from 'axios';

const content = ref('');
const images = ref([]);
const uploading = ref(false);

const handleImageUpload = async (event) => {
  const files = event.target.files;
  
  if (images.value.length + files.length > 9) {
    alert('最多只能上传9张图片');
    return;
  }

  uploading.value = true;
  const formData = new FormData();
  
  Array.from(files).forEach(file => {
    formData.append('files', file);
  });

  try {
    const response = await axios.post('/api/v1/upload/file', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    const uploadedUrls = response.data.data.map(item => item.url);
    images.value = [...images.value, ...uploadedUrls];
  } catch (error) {
    alert('图片上传失败：' + error.message);
  } finally {
    uploading.value = false;
  }
};

const removeImage = (index) => {
  images.value = images.value.filter((_, i) => i !== index);
};

const handleSubmit = async () => {
  if (!content.value.trim()) {
    alert('请输入评论内容');
    return;
  }

  try {
    await axios.post('/api/v1/comment', {
      content: content.value,
      articleId: 1, // 替换为实际的文章ID
      images: images.value
    }, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    alert('评论发布成功！');
    content.value = '';
    images.value = [];
  } catch (error) {
    alert('评论发布失败：' + error.message);
  }
};
</script>

<style scoped>
.comment-form {
  padding: 20px;
  border: 1px solid #ddd;
  border-radius: 8px;
}

textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  resize: vertical;
}

.image-preview {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin: 15px 0;
}

.image-item {
  position: relative;
  aspect-ratio: 1;
  border-radius: 4px;
  overflow: hidden;
}

.image-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-item button {
  position: absolute;
  top: 5px;
  right: 5px;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  border: none;
  border-radius: 4px;
  padding: 5px 10px;
  cursor: pointer;
}

.actions {
  display: flex;
  gap: 10px;
  margin-top: 15px;
}

button {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  background: #007bff;
  color: white;
  cursor: pointer;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
```

## 评论显示示例

### React 评论显示组件

```jsx
function CommentDisplay({ comment }) {
  return (
    <div className="comment">
      <div className="comment-header">
        <img src={comment.author.avatar} alt={comment.author.nickname} />
        <span>{comment.author.nickname}</span>
        <span>{new Date(comment.createdAt).toLocaleString()}</span>
      </div>
      
      <div className="comment-content">
        {comment.content}
      </div>

      {/* 显示图片 */}
      {comment.images && comment.images.length > 0 && (
        <div className="comment-images">
          {comment.images.map((url, index) => (
            <img 
              key={index} 
              src={url} 
              alt={`评论图片${index + 1}`}
              onClick={() => openImageViewer(url)}
            />
          ))}
        </div>
      )}

      <div className="comment-actions">
        <button onClick={() => handleLike(comment.id)}>
          👍 {comment.likes}
        </button>
        <button onClick={() => handleReply(comment.id)}>
          💬 回复
        </button>
      </div>
    </div>
  );
}
```

### CSS 样式

```css
.comment {
  padding: 15px;
  border-bottom: 1px solid #eee;
}

.comment-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.comment-header img {
  width: 40px;
  height: 40px;
  border-radius: 50%;
}

.comment-content {
  margin-bottom: 10px;
  line-height: 1.6;
}

.comment-images {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin: 15px 0;
}

.comment-images img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 4px;
  cursor: pointer;
  transition: transform 0.2s;
}

.comment-images img:hover {
  transform: scale(1.05);
}

/* 单张图片时显示大一点 */
.comment-images:has(img:only-child) {
  grid-template-columns: 1fr;
  max-width: 400px;
}

/* 两张图片时 */
.comment-images:has(img:nth-child(2):last-child) {
  grid-template-columns: repeat(2, 1fr);
}

.comment-actions {
  display: flex;
  gap: 15px;
}

.comment-actions button {
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  padding: 5px 10px;
}

.comment-actions button:hover {
  color: #007bff;
}
```

## API 响应示例

### 创建评论响应

```json
{
  "success": true,
  "message": "评论创建成功",
  "data": {
    "id": 123,
    "content": "这是一条带图片的评论",
    "images": [
      "https://example.com/uploads/abc123.jpg",
      "https://example.com/uploads/def456.jpg"
    ],
    "likes": 0,
    "replyCount": 0,
    "status": "PUBLISHED",
    "author": {
      "id": 1,
      "username": "user1",
      "nickname": "用户1",
      "avatar": "https://example.com/avatar.jpg"
    },
    "createdAt": "2024-01-14T10:00:00.000Z",
    "updatedAt": "2024-01-14T10:00:00.000Z"
  }
}
```

### 获取评论列表响应

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 123,
        "content": "这是一条带图片的评论",
        "images": [
          "https://example.com/uploads/abc123.jpg",
          "https://example.com/uploads/def456.jpg"
        ],
        "likes": 5,
        "replyCount": 2,
        "author": {
          "id": 1,
          "nickname": "用户1",
          "avatar": "https://example.com/avatar.jpg"
        },
        "createdAt": "2024-01-14T10:00:00.000Z"
      }
    ],
    "total": 100,
    "page": 1,
    "limit": 20
  }
}
```

## 注意事项

### 1. 图片数量限制
- 每条评论最多支持 9 张图片
- 前端需要验证图片数量

### 2. 图片大小限制
- 使用 upload 模块的限制（通常为 5MB）
- 建议前端压缩图片后上传

### 3. 图片格式
- 支持常见图片格式：JPEG、PNG、GIF、WebP
- 由 upload 模块控制

### 4. 图片存储
- 图片通过 upload 模块上传
- 评论中只存储图片 URL
- 删除评论不会自动删除图片文件

### 5. 权限控制
- 上传图片需要 `upload:create` 权限
- 创建评论需要 `comment:create` 权限

## 最佳实践

### 1. 图片压缩
建议前端在上传前压缩图片：

```javascript
async function compressImage(file, maxWidth = 1200, quality = 0.8) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          resolve(new File([blob], file.name, { type: 'image/jpeg' }));
        }, 'image/jpeg', quality);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}
```

### 2. 图片预览
提供图片预览功能，让用户在上传前确认：

```javascript
function previewImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.readAsDataURL(file);
  });
}
```

### 3. 图片查看器
实现图片点击放大查看功能：

```javascript
function openImageViewer(imageUrl) {
  // 使用第三方库如 react-image-lightbox 或自己实现
  // 显示大图和图片浏览功能
}
```

## 常见问题

### Q: 如何限制图片上传数量？

A: 在前端验证：

```javascript
if (images.length + files.length > 9) {
  alert('最多只能上传9张图片');
  return;
}
```

### Q: 如何删除已上传的图片？

A: 从 images 数组中移除对应的 URL：

```javascript
const handleRemoveImage = (index) => {
  setImages(images.filter((_, i) => i !== index));
};
```

### Q: 评论中的图片可以编辑吗？

A: 可以，通过更新评论接口修改 images 字段。

### Q: 删除评论会删除图片吗？

A: 不会自动删除。图片文件仍保留在服务器上，需要单独管理。

## 更新日志

### v1.0.0 (2024-01-14)

- ✅ 评论实体添加 images 字段
- ✅ CreateCommentDto 添加 images 字段
- ✅ 支持最多 9 张图片
- ✅ 使用现有 upload 模块上传
- ✅ 完整的前端集成示例

---

**维护者**: 开发团队  
**最后更新**: 2024-01-14
