# Elasticsearch 搜索集成

本项目已集成 Elasticsearch 作为文章搜索引擎，支持**可选配置**，未配置时自动回退到数据库 LIKE 查询。

## 功能特性

- **可选配置**: 不配置 ES 时，搜索功能完全不受影响，自动使用原有 TypeORM LIKE 查询
- **中文分词**: 支持 IK 分词器（可选），搜索更精准
- **自动同步**: 文章创建/更新/删除时自动同步到 ES
- **管理接口**: 提供全量同步、索引状态查询等管理功能
- **完全一致**: 返回数据格式与原搜索完全一致

## 配置方法

在 `.env` 文件中添加以下配置（可选）:

```env
# ===========================================
# Elasticsearch 配置（可选）
# 如果不配置，搜索功能将回退到数据库 LIKE 查询
# ===========================================
# ES 节点地址，例如：http://localhost:9200
# 留空则不启用 Elasticsearch
ELASTICSEARCH_NODE=http://localhost:9200
# ES 认证用户名（如果需要）
ELASTICSEARCH_USERNAME=
# ES 认证密码（如果需要）
ELASTICSEARCH_PASSWORD=
# 是否使用 IK 分词器（需要安装 IK 插件）
# 默认 false，使用 standard 分词器
# 设为 true 并安装 IK 插件可获得更好的中文分词效果
ELASTICSEARCH_USE_IK=false
```

### 分词器选择

| 分词器 | 配置 | 中文搜索效果 | 需要安装插件 |
|--------|------|-------------|-------------|
| standard | `ELASTICSEARCH_USE_IK=false` | 一般（按字切分） | 否 |
| ik_max_word | `ELASTICSEARCH_USE_IK=true` | 好（按词切分） | 是 |

**建议**：
- 快速体验：使用默认 `standard` 分词器，无需安装插件
- 生产环境：安装 IK 插件并启用 `ELASTICSEARCH_USE_IK=true`

## 使用方法

### 1. 启用 Elasticsearch

配置 `ELASTICSEARCH_NODE` 后重启服务即可自动启用 ES 搜索。

### 2. 初始化同步已有数据

首次启用 ES 时，需要同步已有文章数据：

```bash
# 调用管理接口同步所有已发布文章
POST /search/sync/articles
Authorization: Bearer <管理员Token>

# 可选参数
{
  "batchSize": 100,  // 每批同步数量，默认100
  "status": "PUBLISHED"  // 同步指定状态的文章，默认PUBLISHED
}
```

### 3. 查看 ES 状态

```bash
GET /search/status
Authorization: Bearer <管理员Token>
```

### 4. 清空索引（谨慎操作）

```bash
POST /search/clear/articles
Authorization: Bearer <管理员Token>
```

## 搜索接口

搜索接口保持不变：

```
GET /article/search?keyword=关键词&page=1&limit=10&sortBy=relevance
```

### 排序方式

- `relevance`: 按相关性排序（ES 启用时）/ 按自定义权重排序（ES 禁用时）
- `latest`: 按最新发布排序
- `views`: 按浏览量排序
- `likes`: 按点赞数排序

## 架构说明

### 回退机制

```
搜索请求 → 检查 ES 是否配置 → 是 → 使用 ES 搜索
                      ↓
                      否 → 回退到 TypeORM LIKE 查询
```

### 数据同步

- **创建文章**: 发布时自动同步到 ES
- **更新文章**: 更新后自动同步到 ES
- **删除文章**: 删除后自动从 ES 移除

### 返回格式

无论使用 ES 还是数据库搜索，返回格式完全一致：

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "list": [...],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 100,
      "totalPages": 10
    }
  }
}
```

## 性能对比

| 数据量 | 数据库 LIKE 查询 | Elasticsearch |
|--------|-----------------|---------------|
| 1万    | ~200ms          | ~10ms         |
| 10万   | ~2s             | ~15ms         |
| 100万  | ~20s            | ~20ms         |

## 故障处理

### ES 连接失败

如果 ES 连接失败，系统会自动回退到数据库搜索，并记录错误日志：

```
ES 搜索失败，回退到数据库搜索: [错误信息]
```

### IK 分词器错误

如果看到 `failed to find tokenizer under name [ik_max_word]` 错误，说明：
1. 未安装 IK 插件，但配置了 `ELASTICSEARCH_USE_IK=true`
2. 解决方案：
   - 方法1：将 `ELASTICSEARCH_USE_IK` 设为 `false`（使用标准分词器）
   - 方法2：安装 IK 插件（见上文安装步骤）

### 数据不一致

如果发现 ES 数据与数据库不一致，可以调用同步接口重新同步：

```bash
POST /search/sync/articles
```

## 开发注意事项

1. **不要**在 ArticleService 外直接操作 ES，所有搜索应通过 `SearchService`
2. **无需**修改搜索相关的前端代码，接口完全兼容
3. **注意** ES 索引需要手动初始化同步已有数据
4. **注意** 修改分词器配置后需要清空重建索引

## 安装 IK 分词插件（可选）

如果需要更好的中文分词效果，可以安装 IK 插件：

```bash
# 进入 ES 容器
docker exec -it elasticsearch bash

# 安装 IK 分词插件（版本需与 ES 一致）
./bin/elasticsearch-plugin install https://github.com/medcl/elasticsearch-analysis-ik/releases/download/v8.11.0/elasticsearch-analysis-ik-8.11.0.zip

# 重启 ES
exit
docker restart elasticsearch
```

安装后，设置 `ELASTICSEARCH_USE_IK=true` 并**清空重建索引**：

```bash
POST /search/clear/articles
POST /search/sync/articles
```

## 相关文件

- `src/modules/search/` - 搜索模块
- `src/config/elasticsearch.config.ts` - ES 配置
- `src/modules/article/article.service.ts` - 搜索逻辑（含回退机制）
