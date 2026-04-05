import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ElasticsearchService } from "@nestjs/elasticsearch";
import { ConfigService } from "@nestjs/config";
import { Article } from "../article/entities/article.entity";
import { ELASTICSEARCH_INDEX, elasticsearchConfig } from "../../config/elasticsearch.config";
import { articleMapping } from "./article-search.mapping";

export interface SearchResult {
  ids: number[];
  total: number;
  hits: Array<{
    id: number;
    score: number;
    highlight?: Record<string, string[]>;
  }>;
}

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);
  private readonly isEnabled: boolean;

  constructor(
    private readonly elasticsearchService: ElasticsearchService,
    private readonly configService: ConfigService,
  ) {
    const config = elasticsearchConfig(configService);
    this.isEnabled = !!config;
  }

  async onModuleInit() {
    if (!this.isEnabled) {
      this.logger.log("Elasticsearch 未配置，跳过初始化");
      return;
    }

    try {
      // 检查 ES 连接
      const health = await this.elasticsearchService.ping();
      this.logger.log("Elasticsearch 连接成功", health);

      // 确保索引存在
      await this.ensureIndexExists();
    } catch (error) {
      this.logger.error("Elasticsearch 连接失败:", error.message);
    }
  }

  /**
   * 检查 ES 是否可用
   */
  isElasticsearchEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * 确保文章搜索索引存在
   */
  private async ensureIndexExists() {
    const indexName = ELASTICSEARCH_INDEX.ARTICLES;
    const exists = await this.elasticsearchService.indices.exists({
      index: indexName,
    });

    if (!exists) {
      this.logger.log(`创建索引: ${indexName}`);
      await this.elasticsearchService.indices.create({
        index: indexName,
        mappings: articleMapping as any,
        settings: {
          analysis: {
            analyzer: {
              ik_max_word: {
                type: "custom",
                tokenizer: "ik_max_word",
              },
              ik_smart: {
                type: "custom",
                tokenizer: "ik_smart",
              },
            },
          },
        },
      });
      this.logger.log(`索引 ${indexName} 创建成功`);
    } else {
      this.logger.log(`索引 ${indexName} 已存在`);
    }
  }

  /**
   * 同步文章到 Elasticsearch
   */
  async syncArticle(article: Article) {
    if (!this.isEnabled) {
      return;
    }

    try {
      await this.elasticsearchService.index({
        index: ELASTICSEARCH_INDEX.ARTICLES,
        id: article.id.toString(),
        body: this.articleToDocument(article),
      });
    } catch (error) {
      this.logger.error(`同步文章 ${article.id} 失败:`, error.message);
    }
  }

  /**
   * 批量同步文章
   */
  async bulkSyncArticles(articles: Article[]) {
    if (!this.isEnabled || articles.length === 0) {
      return;
    }

    try {
      const body = articles.flatMap((article) => [
        { index: { _index: ELASTICSEARCH_INDEX.ARTICLES, _id: article.id.toString() } },
        this.articleToDocument(article),
      ]);

      await this.elasticsearchService.bulk({ body });
      this.logger.log(`批量同步 ${articles.length} 篇文章到 ES`);
    } catch (error) {
      this.logger.error("批量同步文章失败:", error.message);
    }
  }

  /**
   * 从 Elasticsearch 删除文章
   */
  async deleteArticle(articleId: number) {
    if (!this.isEnabled) {
      return;
    }

    try {
      await this.elasticsearchService.delete({
        index: ELASTICSEARCH_INDEX.ARTICLES,
        id: articleId.toString(),
      });
    } catch (error) {
      // 文档不存在时忽略错误
      if (error.meta?.statusCode !== 404) {
        this.logger.error(`删除文章 ${articleId} 失败:`, error.message);
      }
    }
  }

  /**
   * 搜索文章
   */
  async searchArticles(params: {
    keyword: string;
    page: number;
    limit: number;
    categoryId?: number;
    sortBy: "relevance" | "latest" | "views" | "likes";
    hasPermission?: boolean;
    currentUserId?: number;
  }): Promise<SearchResult> {
    if (!this.isEnabled) {
      throw new Error("Elasticsearch 未启用");
    }

    const { keyword, page, limit, categoryId, sortBy, hasPermission, currentUserId } = params;

    const from = (page - 1) * limit;

    // 构建查询条件
    const mustQueries: any[] = [
      {
        multi_match: {
          query: keyword,
          fields: [
            "title^10",
            "title.keyword^5",
            "summary^3",
            "content^2",
            "tags^4",
            "categoryName^3",
            "authorName^2",
          ],
          type: "best_fields",
          operator: "or",
          minimum_should_match: "1",
        },
      },
    ];

    // 如果不是管理员，只搜索已发布文章
    if (!hasPermission) {
      mustQueries.push({ term: { status: "PUBLISHED" } });
    }

    // 如果未登录，只搜索不需要登录的文章
    if (!currentUserId) {
      mustQueries.push({ term: { requireLogin: false } });
    }

    // 分类过滤
    if (categoryId) {
      mustQueries.push({ term: { categoryId } });
    }

    // 构建排序
    const sort: any[] = [];
    switch (sortBy) {
      case "latest":
        sort.push({ sort: { order: "desc" } });
        sort.push({ createdAt: { order: "desc" } });
        break;
      case "views":
        sort.push({ sort: { order: "desc" } });
        sort.push({ views: { order: "desc" } });
        sort.push({ createdAt: { order: "desc" } });
        break;
      case "likes":
        sort.push({ sort: { order: "desc" } });
        sort.push({ likes: { order: "desc" } });
        sort.push({ createdAt: { order: "desc" } });
        break;
      default:
        // relevance - 按相关性排序
        sort.push({ _score: { order: "desc" } });
        sort.push({ sort: { order: "desc" } });
        sort.push({ views: { order: "desc" } });
        break;
    }

    const response = await this.elasticsearchService.search({
      index: ELASTICSEARCH_INDEX.ARTICLES,
      from,
      size: limit,
      query: {
        bool: {
          must: mustQueries,
        },
      },
      sort,
      highlight: {
        fields: {
          title: {},
          summary: {},
        },
        pre_tags: ['<mark>'],
        post_tags: ['</mark>'],
      },
    });

    const hits = response.hits.hits;
    const total = typeof response.hits.total === "number"
      ? response.hits.total
      : (response.hits.total?.value || 0);

    return {
      ids: hits.map((hit) => parseInt(hit._id!)),
      total,
      hits: hits.map((hit) => ({
        id: parseInt(hit._id!),
        score: hit._score || 0,
        highlight: hit.highlight,
      })),
    };
  }

  /**
   * 将 Article 实体转换为 ES 文档
   */
  private articleToDocument(article: Article): Record<string, any> {
    return {
      id: article.id,
      title: article.title,
      content: article.content || "",
      summary: article.summary || "",
      authorId: article.authorId,
      authorName: article.author?.username || "",
      categoryId: article.category?.id,
      categoryName: article.category?.name || "",
      tags: article.tags?.map((t) => t.name).join(",") || "",
      tagIds: article.tags?.map((t) => t.id) || [],
      status: article.status,
      views: article.views || 0,
      likes: article.likes || 0,
      commentCount: article.commentCount || 0,
      requireLogin: article.requireLogin || false,
      requireFollow: article.requireFollow || false,
      requireMembership: article.requireMembership || false,
      requirePayment: article.requirePayment || false,
      viewPrice: article.viewPrice || 0,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
      sort: article.sort || 0,
      type: article.type || "text",
    };
  }

  /**
   * 获取索引统计信息
   */
  async getIndexStats(): Promise<{ documentCount: number; indexSize?: string }> {
    if (!this.isEnabled) {
      return { documentCount: 0 };
    }

    try {
      const stats = await this.elasticsearchService.indices.stats({
        index: ELASTICSEARCH_INDEX.ARTICLES,
      });

      const indexStats = stats.indices?.[ELASTICSEARCH_INDEX.ARTICLES];
      const documentCount = indexStats?.total?.docs?.count || 0;
      const indexSize = indexStats?.total?.store?.size_in_bytes
        ? this.formatBytes(indexStats.total.store.size_in_bytes)
        : "0 B";

      return {
        documentCount,
        indexSize,
      };
    } catch (error) {
      this.logger.error("获取索引统计信息失败:", error.message);
      return { documentCount: 0 };
    }
  }

  /**
   * 清空索引
   */
  async clearIndex() {
    if (!this.isEnabled) {
      return;
    }

    try {
      const exists = await this.elasticsearchService.indices.exists({
        index: ELASTICSEARCH_INDEX.ARTICLES,
      });

      if (exists) {
        await this.elasticsearchService.indices.delete({
          index: ELASTICSEARCH_INDEX.ARTICLES,
        });
        this.logger.log(`索引 ${ELASTICSEARCH_INDEX.ARTICLES} 已删除`);
      }

      // 重新创建索引
      await this.ensureIndexExists();
    } catch (error) {
      this.logger.error("清空索引失败:", error.message);
      throw error;
    }
  }

  /**
   * 格式化字节数
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }
}
