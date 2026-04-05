import { Controller, Post, Get, UseGuards, Body, Query } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionGuard } from "../../common/guards/permission.guard";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { SearchService } from "./search.service";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Article } from "../article/entities/article.entity";

@ApiTags("搜索管理")
@Controller("search")
@ApiBearerAuth()
export class SearchController {
  constructor(
    private readonly searchService: SearchService,
    @InjectRepository(Article)
    private readonly articleRepository: Repository<Article>,
  ) {}

  @Post("sync/articles")
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions("article:manage")
  @ApiOperation({ summary: "同步文章到 Elasticsearch（全量同步）" })
  async syncArticles(
    @Body() body?: { batchSize?: number; status?: string },
  ) {
    if (!this.searchService.isElasticsearchEnabled()) {
      return {
        success: false,
        message: "Elasticsearch 未启用",
      };
    }

    const batchSize = body?.batchSize || 100;
    const status = body?.status as Article["status"] || "PUBLISHED";

    // 分批查询文章
    let page = 1;
    let hasMore = true;
    let totalSynced = 0;

    while (hasMore) {
      const articles = await this.articleRepository.find({
        where: { status },
        relations: ["author", "category", "tags"],
        skip: (page - 1) * batchSize,
        take: batchSize,
      });

      if (articles.length === 0) {
        hasMore = false;
        break;
      }

      await this.searchService.bulkSyncArticles(articles);
      totalSynced += articles.length;
      page++;
    }

    return {
      success: true,
      message: `成功同步 ${totalSynced} 篇文章到 Elasticsearch`,
      data: { totalSynced },
    };
  }

  @Get("status")
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions("article:manage")
  @ApiOperation({ summary: "获取 Elasticsearch 状态" })
  async getStatus() {
    const isEnabled = this.searchService.isElasticsearchEnabled();

    if (!isEnabled) {
      return {
        success: true,
        data: {
          enabled: false,
          message: "Elasticsearch 未配置",
        },
      };
    }

    try {
      // 获取索引统计信息
      const indexStats = await this.searchService.getIndexStats();

      return {
        success: true,
        data: {
          enabled: true,
          ...indexStats,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: "Elasticsearch 连接异常",
        error: error.message,
      };
    }
  }

  @Post("clear/articles")
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions("article:manage")
  @ApiOperation({ summary: "清空文章搜索索引" })
  async clearArticles() {
    if (!this.searchService.isElasticsearchEnabled()) {
      return {
        success: false,
        message: "Elasticsearch 未启用",
      };
    }

    try {
      await this.searchService.clearIndex();
      return {
        success: true,
        message: "文章搜索索引已清空",
      };
    } catch (error) {
      return {
        success: false,
        message: "清空索引失败",
        error: error.message,
      };
    }
  }
}
