# 评论 rootId 功能说明

## 🎯 功能概述

在评论系统中添加了 `rootId` 字段，用于标识评论的顶级父评论，这样可以更好地处理多层级评论的查询和管理。

## 📋 数据库设计

### Comment 实体字段

```typescript
@Entity({ comment: "评论表" })
export class Comment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "text", comment: "评论内容" })
  content: string;

  @ManyToOne(() => Comment, (comment) => comment.replies, { nullable: true })
  parent: Comment;

  @Column({ nullable: true })
  rootId: number; // 新增：顶级评论ID

  @OneToMany(() => Comment, (comment) => comment.parent)
  replies: Comment[];

  // ... 其他字段
}
```

## 🔄 rootId 设置规则

### 1. 顶级评论
- `rootId` = 自己的 `id`
- `parent` = `null`

### 2. 子评论
- `rootId` = 顶级评论的 `id`
- `parent` = 直接父评论

### 3. 多层级评论示例

```
评论A (id: 1, rootId: 1, parent: null)
├── 评论B (id: 2, rootId: 1, parent: 1)
│   ├── 评论C (id: 3, rootId: 1, parent: 2)
│   │   └── 评论D (id: 4, rootId: 1, parent: 3)
│   └── 评论E (id: 5, rootId: 1, parent: 2)
└── 评论F (id: 6, rootId: 1, parent: 1)
```

## 🛠️ API 接口

### 1. 创建评论
```http
POST /comment
```

**请求体：**
```json
{
  "articleId": 1,
  "parentId": 2,  // 可选，回复评论时提供
  "content": "评论内容"
}
```

**响应：**
```json
{
  "id": 3,
  "content": "评论内容",
  "parentId": 2,
  "rootId": 1,  // 顶级评论的ID
  "author": { ... }
}
```

### 2. 获取直接回复
```http
GET /comment/:id/replies?page=1&limit=10
```

**功能：** 只返回指定评论的直接子评论（第一层回复）

### 3. 获取评论详情（已优化）
```http
GET /comment/:id?page=1&limit=20
```

**功能：** 返回指定评论的详情，以及该评论树下的所有子评论（包括多层级回复）

## 💡 使用场景

### 1. 评论列表展示
- 显示顶级评论
- 每个顶级评论显示前几条直接回复
- 点击"查看更多回复"时使用 `/replies` 接口

### 2. 评论详情页面
- 显示评论详情
- 使用 `/comment/:id` 接口获取该评论树下的所有子评论
- 前端可以构建完整的评论树结构

### 3. 评论管理
- 管理员可以查看某个顶级评论下的所有回复
- 便于批量操作和管理

## 🔧 实现细节

### 1. 创建评论时的 rootId 设置

```typescript
async createComment(createCommentDto: CreateCommentDto, author: User) {
  // ... 验证逻辑

  if (parentId) {
    const parent = await this.commentRepository.findOne({
      where: { id: parentId },
      relations: ["article"],
    });

    comment.parent = parent;
    // 设置 rootId：如果父评论有 rootId 就用父评论的，否则用父评论的 id
    comment.rootId = parent.rootId || parent.id;
  }

  return await this.commentRepository.save(comment);
}
```

### 2. 查询评论详情（包含所有子评论）

```typescript
async findCommentDetail(id: number, pagination: PaginationDto) {
  const comment = await this.commentRepository.findOne({
    where: { id },
    relations: ["author", "article", "parent"],
  });

  // 获取 rootId：如果是顶级评论就用自己的 id，否则用 rootId
  const rootId = comment.rootId || comment.id;

  // 分页查所有子评论（包括多层级）
  const [replies, totalReplies] = await this.commentRepository.findAndCount({
    where: { rootId: rootId, status: "PUBLISHED" },
    relations: ["author", "parent", "parent.author", "article"],
    order: { createdAt: "ASC" },
    skip: (page - 1) * limit,
    take: limit,
  });

  return ListUtil.buildPaginatedList(replies, totalReplies, page, limit);
}
```

### 3. 数据安全处理

```typescript
private static addParentAndRootId(comment: any): any {
  const parentId = comment.parent ? comment.parent.id : null;
  // 优先使用数据库中的 rootId，如果没有则计算
  const rootId = comment.rootId || (parentId
    ? (comment.parent.rootId ?? comment.parent.id)
    : comment.id);
  
  return {
    ...comment,
    author: sanitizeUser(comment.author),
    parent: comment.parent ? { 
      id: comment.parent.id,
      author: comment.parent.author ? sanitizeUser(comment.parent.author) : null
    } : null,
    parentId,
    rootId,
  };
}
```

## 🧪 测试验证

运行测试文件验证功能：

```bash
node test-comment-rootid.js
```

测试内容包括：
- 创建顶级评论（验证 rootId 是自己的 id）
- 创建多层级回复（验证 rootId 都是顶级评论的 id）
- 获取直接回复（验证只返回第一层）
- 获取所有子评论（验证返回所有层级）

## ✅ 优势

1. **查询效率高** - 通过 rootId 可以快速查询某个顶级评论下的所有子评论
2. **层级清晰** - 每个评论都知道自己属于哪个顶级评论
3. **扩展性好** - 支持无限层级的评论结构
4. **管理方便** - 管理员可以轻松管理某个评论树下的所有内容
5. **前端友好** - 前端可以根据 rootId 构建完整的评论树结构

## 🔄 数据迁移

如果现有数据库中有评论数据，需要执行以下 SQL 来设置 rootId：

```sql
-- 为顶级评论设置 rootId
UPDATE comment SET rootId = id WHERE parent IS NULL;

-- 为子评论设置 rootId（递归更新）
UPDATE comment c1 
SET rootId = (
  SELECT c2.rootId 
  FROM comment c2 
  WHERE c2.id = c1.parent 
  AND c2.rootId IS NOT NULL
)
WHERE c1.parent IS NOT NULL 
AND c1.rootId IS NULL;
```
