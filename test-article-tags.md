# 文章标签自动创建功能测试

## 前端传参示例

### 1. 使用标签名称创建文章（推荐）
```json
POST /articles
{
  "title": "Vue.js 3.0 新特性介绍",
  "content": "Vue.js 3.0 带来了许多激动人心的新特性...",
  "categoryId": 1,
  "tagNames": ["Vue.js", "JavaScript", "前端开发", "新特性"],
  "status": "PUBLISHED"
}
```

### 2. 使用标签ID创建文章
```json
POST /articles
{
  "title": "TypeScript 最佳实践",
  "content": "TypeScript 是现代前端开发的重要工具...",
  "categoryId": 1,
  "tagIds": [1, 2, 3],
  "status": "PUBLISHED"
}
```

### 3. 混合使用（ID + 名称）
```json
POST /articles
{
  "title": "React vs Vue 对比",
  "content": "React 和 Vue 都是优秀的前端框架...",
  "categoryId": 1,
  "tagIds": [1, 2],
  "tagNames": ["React", "对比分析"],
  "status": "PUBLISHED"
}
```

## 后端处理逻辑

1. **标签ID处理**：直接查找现有标签
2. **标签名称处理**：
   - 先查找是否存在同名标签
   - 如果不存在，自动创建新标签
   - 避免重复添加相同标签
3. **日志记录**：记录自动创建的标签信息

## 更新文章示例

```json
PUT /articles/1
{
  "title": "更新后的标题",
  "tagNames": ["新标签1", "新标签2"],
  "status": "PUBLISHED"
}
```

## 注意事项

1. 标签名称会自动去除首尾空格
2. 重复的标签名称会被自动去重
3. 自动创建的标签描述格式为："自动创建的标签: {标签名}"
4. 支持同时使用 tagIds 和 tagNames，系统会合并处理 