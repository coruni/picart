import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { OnEvent } from "@nestjs/event-emitter";
import { SearchService } from "./search.service";
import { Article } from "../article/entities/article.entity";

@Injectable()
export class SearchSyncService {
  private readonly logger = new Logger(SearchSyncService.name);

  constructor(
    private readonly searchService: SearchService,
    @InjectRepository(Article)
    private readonly articleRepository: Repository<Article>,
  ) {}

  /**
   * 文章创建后同步到 ES
   */
  @OnEvent("article.created")
  async handleArticleCreated(payload: { userId: number; articleId: number }) {
    if (!this.searchService.isElasticsearchEnabled()) {
      return;
    }

    try {
      const article = await this.articleRepository.findOne({
        where: { id: payload.articleId },
        relations: ["author", "category", "tags"],
      });

      if (article) {
        await this.searchService.syncArticle(article);
        this.logger.log(`文章 ${payload.articleId} 已同步到 ES`);
      }
    } catch (error) {
      this.logger.error(`同步文章 ${payload.articleId} 失败:`, error.message);
    }
  }

  /**
   * 文章更新后同步到 ES
   */
  @OnEvent("article.updated")
  async handleArticleUpdated(payload: { articleId: number }) {
    if (!this.searchService.isElasticsearchEnabled()) {
      return;
    }

    try {
      const article = await this.articleRepository.findOne({
        where: { id: payload.articleId },
        relations: ["author", "category", "tags"],
      });

      if (article) {
        await this.searchService.syncArticle(article);
        this.logger.log(`文章 ${payload.articleId} 更新已同步到 ES`);
      }
    } catch (error) {
      this.logger.error(`同步文章更新 ${payload.articleId} 失败:`, error.message);
    }
  }

  /**
   * 文章删除后从 ES 移除
   */
  @OnEvent("article.deleted")
  async handleArticleDeleted(payload: { articleId: number }) {
    if (!this.searchService.isElasticsearchEnabled()) {
      return;
    }

    try {
      await this.searchService.deleteArticle(payload.articleId);
      this.logger.log(`文章 ${payload.articleId} 已从 ES 删除`);
    } catch (error) {
      this.logger.error(`从 ES 删除文章 ${payload.articleId} 失败:`, error.message);
    }
  }

  /**
   * 文章状态变更后同步到 ES
   */
  @OnEvent("article.statusChanged")
  async handleArticleStatusChanged(payload: { articleId: number; status: string }) {
    if (!this.searchService.isElasticsearchEnabled()) {
      return;
    }

    try {
      const article = await this.articleRepository.findOne({
        where: { id: payload.articleId },
        relations: ["author", "category", "tags"],
      });

      if (article) {
        await this.searchService.syncArticle(article);
        this.logger.log(`文章 ${payload.articleId} 状态变更已同步到 ES`);
      }
    } catch (error) {
      this.logger.error(`同步文章状态 ${payload.articleId} 失败:`, error.message);
    }
  }
}
