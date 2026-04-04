# 图片压缩与上传模块升级说明

## 概述

本次升级引入了后端图片压缩功能，并优化了图片数据的存储和返回格式。

## 主要变更

### 1. 后端图片压缩

- 使用 Sharp 库进行高性能图片处理
- 支持生成多尺寸缩略图（thumb, small, medium, large）
- 输出格式支持 WebP、JPEG、PNG、AVIF
- 可通过环境变量配置是否启用

### 2. 数据格式升级

**旧格式**：逗号分隔的 URL 字符串
```
"https://example.com/uploads/img1.jpg,https://example.com/uploads/img2.jpg"
```

**新格式**：JSON 对象数组
```json
[
  {
    "url": "https://example.com/uploads/img1-medium.webp",
    "original": "https://example.com/uploads/img1-original.jpg",
    "width": 800,
    "height": 600,
    "size": 45678,
    "thumbnails": {
      "thumb": "https://example.com/uploads/img1-thumb.webp",
      "small": "https://example.com/uploads/img1-small.webp",
      "medium": "https://example.com/uploads/img1-medium.webp",
      "large": "https://example.com/uploads/img1-large.webp"
    }
  }
]
```

### 3. Upload 实体扩展

新增字段：
- `original`: 原图信息（JSON）
- `thumbnails`: 缩略图信息列表（JSON）
- `processed`: 是否已处理压缩（boolean）

## 数据库迁移

### MySQL

```sql
-- 为 uploads 表添加新字段
ALTER TABLE uploads
  ADD COLUMN original JSON NULL COMMENT '原图信息（压缩后保留原图时）',
  ADD COLUMN thumbnails JSON NULL COMMENT '缩略图信息列表',
  ADD COLUMN processed BOOLEAN DEFAULT FALSE COMMENT '是否已处理压缩';

-- 创建索引优化查询
CREATE INDEX idx_uploads_processed ON uploads(processed);
```

### TypeORM 同步

如果使用 `DB_SYNC=true`，TypeORM 会自动创建新字段。

## 配置说明

在 `.env` 文件中添加以下配置：

```bash
# ===========================================
# 图片压缩配置
# ===========================================
# 是否启用图片压缩 (true/false)
UPLOAD_COMPRESSION_ENABLED=false

# 压缩输出格式: webp | jpeg | png | avif
UPLOAD_COMPRESSION_FORMAT=webp

# 压缩质量 1-100
UPLOAD_COMPRESSION_QUALITY=80

# 最大宽度限制（超过则压缩）
UPLOAD_COMPRESSION_MAX_WIDTH=3840

# 最大高度限制（超过则压缩）
UPLOAD_COMPRESSION_MAX_HEIGHT=2160

# 是否保留原图 (true/false)
UPLOAD_KEEP_ORIGINAL=false

# 前端预压缩建议配置
UPLOAD_CLIENT_MAX_WIDTH=1920
UPLOAD_CLIENT_QUALITY=80
UPLOAD_CLIENT_FORMAT=webp
```

## 安装依赖

```bash
pnpm install
# 或
npm install
```

## 重启服务

```bash
pnpm run dev
```

## API 变更

### 文章接口

**请求不变**，**返回格式变更**。

文章对象中的 `images` 字段从逗号分隔字符串变为 ImageObject 数组：

```typescript
interface ImageObject {
  url: string;           // 默认 URL（通常是 medium 尺寸）
  original?: string;     // 原图 URL
  width?: number;        // 图片宽度
  height?: number;       // 图片高度
  size?: number;         // 文件大小（字节）
  thumbnails?: {         // 各尺寸缩略图
    thumb?: string;      // 200x200
    small?: string;      // 400px
    medium?: string;     // 800px
    large?: string;      // 1920px
  };
}
```

### 评论接口

同样，`images` 字段返回 ImageObject 数组。

### 上传接口

上传响应现在包含缩略图信息：

```json
{
  "id": 123,
  "url": "https://example.com/uploads/img-medium.webp",
  "originalName": "photo.jpg",
  "size": 45678,
  "thumbnails": [
    {
      "name": "thumb",
      "url": "https://example.com/uploads/img-thumb.webp",
      "width": 200,
      "height": 200,
      "size": 5234
    }
  ],
  "original": {
    "url": "https://example.com/uploads/img-original.jpg",
    "width": 1920,
    "height": 1080,
    "size": 234567
  }
}
```

## 兼容性说明

### 旧数据兼容

系统完全兼容旧数据：
- 读取时自动检测格式（JSON 或逗号分隔）
- 旧数据会转换为 ImageObject 格式返回
- 写入时统一使用新格式（JSON）

### 迁移策略

1. **渐进式迁移**：无需一次性转换所有旧数据
2. **读写兼容**：新旧格式同时支持
3. **新写入数据**：自动使用新格式

## 性能优化建议

### 1. 使用缩略图

根据展示场景选择合适的尺寸：
- 列表页：使用 `thumb` 或 `small`
- 详情页首屏：使用 `medium`
- 全屏查看：使用 `large` 或 `original`

### 2. 懒加载

配合响应式图片使用：

```html
<img
  src="image.thumbnails.small"
  srcset="
    image.thumbnails.small 400w,
    image.thumbnails.medium 800w,
    image.thumbnails.large 1920w
  "
  sizes="(max-width: 600px) 400px, (max-width: 1200px) 800px, 1920px"
/>
```

### 3. CDN 配置

如果使用 S3 + CDN，确保 CDN 缓存所有缩略图版本：
- 缩略图文件名包含尺寸标识（如 `-thumb.webp`）
- 设置长期缓存头（max-age=31536000）

## 故障排查

### 图片未压缩

1. 检查 `UPLOAD_COMPRESSION_ENABLED` 是否设置为 `true`
2. 检查 sharp 是否正确安装：`pnpm list sharp`
3. 查看日志：`Image X processed successfully`

### 缩略图未生成

1. 检查存储目录权限
2. 查看错误日志：`Image processing failed`
3. 检查源图片格式是否受支持

### 返回格式错误

1. 确认客户端发送的是字符串数组
2. 检查服务端是否正确序列化为 JSON
3. 查看返回数据格式是否为 ImageObject 数组

## 注意事项

1. **存储空间**：启用压缩后会生成多张缩略图，存储空间会增加约 50-100%
2. **CPU 使用**：图片压缩是 CPU 密集型操作，建议在非高峰期处理
3. **异步处理**：压缩是异步进行的，上传响应会立即返回，缩略图稍后生成
