/**
 * 文章模块通知集成示例
 * 
 * 这个文件展示了如何在文章模块中使用增强通知服务
 */

import { Injectable } from '@nestjs/common';
import { EnhancedNotificationService } from '../message/enhanced-notification.service';
import { User } from '../user/entities/user.entity';
import { Article } from './entities/article.entity';
import { ArticleLike } from './entities/article-like.entity';

@Injectable()
export class ArticleNotificationExample {
  constructor(
    private readonly enhancedNotificationService: EnhancedNotificationService,
  ) {}

  /**
   * 示例：处理文章点赞通知
   */
  async handleArticleLikeNotification(
    article: Article,
    liker: User,
    reactionType: string = 'like',
  ) {
    // 排除自己点赞自己的文章
    if (article.author.id === liker.id) {
      return;
    }

    // 只有点赞才发送通知，其他表情不发送
    if (reactionType === 'like') {
      await this.enhancedNotificationService.sendLikeNotification(
        article.author.id,
        liker.nickname || liker.username,
        'article',
        article.title,
      );
    }
  }

  /**
   * 示例：处理文章发布通知（可选功能）
   */
  async handleArticlePublishNotification(
    article: Article,
    followers: User[],
  ) {
    // 向关注者发送文章发布通知
    const notifications = followers.map(follower => {
      return this.enhancedNotificationService.sendSystemNotification(
        follower.id,
        `${article.author.nickname || article.author.username} 发布了新文章《${article.title}》`,
        '新文章发布',
        {
          type: 'article_published',
          articleId: article.id,
          articleTitle: article.title,
          authorId: article.author.id,
          authorName: article.author.nickname || article.author.username,
        },
      );
    });

    // 并发发送通知
    await Promise.allSettled(notifications);
  }

  /**
   * 示例：处理文章状态变更通知
   */
  async handleArticleStatusChangeNotification(
    article: Article,
    oldStatus: string,
    newStatus: string,
  ) {
    const statusMessages = {
      'PUBLISHED': '文章已发布',
      'DRAFT': '文章已保存为草稿',
      'REJECTED': '文章审核未通过',
      'PENDING': '文章正在审核中',
    };

    const message = statusMessages[newStatus] || `文章状态变更为：${newStatus}`;

    await this.enhancedNotificationService.sendSystemNotification(
      article.author.id,
      `您的文章《${article.title}》${message}`,
      '文章状态通知',
      {
        type: 'article_status_change',
        articleId: article.id,
        articleTitle: article.title,
        oldStatus,
        newStatus,
      },
    );
  }

  /**
   * 示例：批量处理点赞通知
   */
  async handleBatchLikeNotifications(
    likes: Array<{
      article: Article;
      liker: User;
      reactionType: string;
    }>,
  ) {
    const notifications = likes
      .filter(({ article, liker, reactionType }) => {
        // 过滤掉自己点赞自己的文章，且只处理点赞
        return article.author.id !== liker.id && reactionType === 'like';
      })
      .map(({ article, liker }) => {
        return this.enhancedNotificationService.sendLikeNotification(
          article.author.id,
          liker.nickname || liker.username,
          'article',
          article.title,
        );
      });

    // 并发发送通知
    await Promise.allSettled(notifications);
  }
}

/**
 * 使用说明：
 * 
 * 1. 在 ArticleService 中已经集成了点赞通知功能
 * 2. 点赞文章时会自动发送通知
 * 3. 通知会根据用户配置决定是否发送
 * 4. 通知发送失败不会影响点赞操作
 * 
 * 通知类型：
 * - 点赞通知：用户点赞文章时通知文章作者
 * - 文章发布通知：发布文章时通知关注者（可选功能）
 * - 状态变更通知：文章状态变更时通知作者（可选功能）
 * 
 * 排除情况：
 * - 自己点赞自己的文章
 * - 用户禁用了点赞通知
 * - 非点赞类型的表情反应
 * 
 * 扩展功能：
 * - 可以添加文章发布通知
 * - 可以添加文章审核状态通知
 * - 可以添加文章被收藏通知
 */
