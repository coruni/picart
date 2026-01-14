import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PointsService } from './points.service';

@Injectable()
export class PointsEventService {
  constructor(private readonly pointsService: PointsService) {}

  /**
   * 监听文章创建事件 - 发布文章获得积分
   */
  @OnEvent('article.created')
  async handleArticleCreated(payload: { userId: number; articleId: number }) {
    try {
      await this.pointsService.addPointsByRule(
        payload.userId,
        'PUBLISH_ARTICLE',
        'ARTICLE',
        payload.articleId,
      );
      console.log(`用户 ${payload.userId} 发布文章获得积分`);
    } catch (error) {
      console.error('发布文章增加积分失败:', error.message);
    }
  }

  /**
   * 监听文章点赞事件 - 点赞文章获得积分
   */
  @OnEvent('article.liked')
  async handleArticleLiked(payload: { userId: number; articleId: number }) {
    try {
      await this.pointsService.addPointsByRule(
        payload.userId,
        'LIKE_ARTICLE',
        'ARTICLE',
        payload.articleId,
      );
      console.log(`用户 ${payload.userId} 点赞文章获得积分`);
    } catch (error) {
      console.error('点赞文章增加积分失败:', error.message);
    }
  }

  /**
   * 监听评论创建事件 - 发表评论获得积分
   */
  @OnEvent('comment.created')
  async handleCommentCreated(payload: { userId: number; articleId: number; commentId: number }) {
    try {
      await this.pointsService.addPointsByRule(
        payload.userId,
        'PUBLISH_COMMENT',
        'COMMENT',
        payload.commentId,
      );
      console.log(`用户 ${payload.userId} 发表评论获得积分`);
    } catch (error) {
      console.error('发表评论增加积分失败:', error.message);
    }
  }

  /**
   * 监听评论点赞事件 - 点赞评论获得积分
   */
  @OnEvent('comment.liked')
  async handleCommentLiked(payload: { userId: number; commentId: number; articleId?: number }) {
    try {
      await this.pointsService.addPointsByRule(
        payload.userId,
        'LIKE_COMMENT',
        'COMMENT',
        payload.commentId,
      );
      console.log(`用户 ${payload.userId} 点赞评论获得积分`);
    } catch (error) {
      console.error('点赞评论增加积分失败:', error.message);
    }
  }

  /**
   * 监听每日登录事件 - 每日登录获得积分
   */
  @OnEvent('user.dailyLogin')
  async handleDailyLogin(payload: { userId: number }) {
    try {
      await this.pointsService.addPointsByRule(payload.userId, 'DAILY_LOGIN');
      console.log(`用户 ${payload.userId} 每日登录获得积分`);
    } catch (error) {
      console.error('每日登录增加积分失败:', error.message);
    }
  }

  /**
   * 监听装饰品购买事件 - 消费积分购买装饰品
   */
  @OnEvent('decoration.purchased')
  async handleDecorationPurchased(payload: {
    userId: number;
    decorationId: number;
    pointsCost: number;
  }) {
    try {
      if (payload.pointsCost > 0) {
        await this.pointsService.spendPoints(payload.userId, {
          amount: payload.pointsCost,
          source: 'BUY_DECORATION',
          description: `购买装饰品 #${payload.decorationId}`,
          relatedType: 'DECORATION',
          relatedId: payload.decorationId,
        });
        console.log(`用户 ${payload.userId} 消费 ${payload.pointsCost} 积分购买装饰品`);
      }
    } catch (error) {
      console.error('购买装饰品扣除积分失败:', error.message);
      throw error; // 抛出错误，让购买流程回滚
    }
  }

  /**
   * 监听文章被点赞事件 - 文章作者获得积分
   */
  @OnEvent('article.receivedLike')
  async handleArticleReceivedLike(payload: { authorId: number; articleId: number; likerId: number }) {
    try {
      await this.pointsService.addPointsByRule(
        payload.authorId,
        'ARTICLE_RECEIVED_LIKE',
        'ARTICLE',
        payload.articleId,
      );
      console.log(`用户 ${payload.authorId} 的文章被点赞获得积分`);
    } catch (error) {
      console.error('文章被点赞增加积分失败:', error.message);
    }
  }

  /**
   * 监听评论被点赞事件 - 评论作者获得积分
   */
  @OnEvent('comment.receivedLike')
  async handleCommentReceivedLike(payload: { authorId: number; commentId: number; likerId: number }) {
    try {
      await this.pointsService.addPointsByRule(
        payload.authorId,
        'COMMENT_RECEIVED_LIKE',
        'COMMENT',
        payload.commentId,
      );
      console.log(`用户 ${payload.authorId} 的评论被点赞获得积分`);
    } catch (error) {
      console.error('评论被点赞增加积分失败:', error.message);
    }
  }

  /**
   * 监听文章被评论事件 - 文章作者获得积分
   */
  @OnEvent('article.receivedComment')
  async handleArticleReceivedComment(payload: {
    authorId: number;
    articleId: number;
    commenterId: number;
  }) {
    try {
      await this.pointsService.addPointsByRule(
        payload.authorId,
        'ARTICLE_RECEIVED_COMMENT',
        'ARTICLE',
        payload.articleId,
      );
      console.log(`用户 ${payload.authorId} 的文章被评论获得积分`);
    } catch (error) {
      console.error('文章被评论增加积分失败:', error.message);
    }
  }

  /**
   * 监听任务进度更新事件 - 更新任务进度
   */
  @OnEvent('task.progress')
  async handleTaskProgress(payload: { userId: number; taskCode: string; increment?: number }) {
    try {
      await this.pointsService.updateTaskProgress(
        payload.userId,
        payload.taskCode,
        payload.increment || 1,
      );
      console.log(`用户 ${payload.userId} 任务 ${payload.taskCode} 进度更新`);
    } catch (error) {
      console.error('更新任务进度失败:', error.message);
    }
  }
}
