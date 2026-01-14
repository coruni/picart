import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EnhancedNotificationService } from './enhanced-notification.service';

@Injectable()
export class NotificationEventService {
  constructor(
    private readonly notificationService: EnhancedNotificationService,
  ) {}

  /**
   * 监听文章点赞事件 - 发送点赞通知
   */
  @OnEvent('article.liked')
  async handleArticleLiked(payload: {
    userId: number;
    articleId: number;
    userName: string;
    articleTitle: string;
    authorId: number;
  }) {
    try {
      // 排除自己点赞自己的文章
      if (payload.userId === payload.authorId) {
        return;
      }

      await this.notificationService.sendLikeNotification(
        payload.authorId,
        payload.userName,
        'article',
        payload.articleTitle,
        payload.articleId,
        payload.articleId,
      );
    } catch (error) {
      console.error('发送文章点赞通知失败:', error);
    }
  }

  /**
   * 监听评论点赞事件 - 发送点赞通知
   */
  @OnEvent('comment.liked')
  async handleCommentLiked(payload: {
    userId: number;
    commentId: number;
    userName: string;
    commentContent: string;
    authorId: number;
    articleId?: number;
  }) {
    try {
      // 排除自己点赞自己的评论
      if (payload.userId === payload.authorId) {
        return;
      }

      await this.notificationService.sendLikeNotification(
        payload.authorId,
        payload.userName,
        'comment',
        payload.commentContent.length > 50
          ? payload.commentContent.substring(0, 50) + '...'
          : payload.commentContent,
        payload.commentId,
        payload.articleId,
      );
    } catch (error) {
      console.error('发送评论点赞通知失败:', error);
    }
  }

  /**
   * 监听评论创建事件 - 发送评论通知
   */
  @OnEvent('comment.created')
  async handleCommentCreated(payload: {
    userId: number;
    userName: string;
    articleId: number;
    articleTitle: string;
    commentId: number;
    commentContent: string;
    authorId: number;
    parentCommentId?: number;
    parentAuthorId?: number;
  }) {
    try {
      // 如果是回复评论
      if (payload.parentCommentId && payload.parentAuthorId) {
        // 排除自己回复自己的评论
        if (payload.userId === payload.parentAuthorId) {
          return;
        }

        await this.notificationService.sendCommentNotification(
          payload.parentAuthorId,
          payload.userName,
          payload.articleTitle,
          payload.commentContent,
          payload.articleId,
          payload.commentId,
          payload.parentCommentId,
        );
      } else {
        // 如果是评论文章，排除自己评论自己的文章
        if (payload.userId === payload.authorId) {
          return;
        }

        await this.notificationService.sendCommentNotification(
          payload.authorId,
          payload.userName,
          payload.articleTitle,
          payload.commentContent,
          payload.articleId,
          payload.commentId,
        );
      }
    } catch (error) {
      console.error('发送评论通知失败:', error);
    }
  }

  /**
   * 监听关注事件 - 发送关注通知
   */
  @OnEvent('user.followed')
  async handleUserFollowed(payload: {
    followerId: number;
    followerName: string;
    followedId: number;
  }) {
    try {
      await this.notificationService.sendFollowNotification(
        payload.followedId,
        payload.followerName,
      );
    } catch (error) {
      console.error('发送关注通知失败:', error);
    }
  }

  /**
   * 监听系统通知事件
   */
  @OnEvent('system.notification')
  async handleSystemNotification(payload: {
    userId: number;
    title: string;
    content: string;
    notificationType?: 'like' | 'follow' | 'payment' | 'system' | 'comment' | 'message' | 'order' | 'invite';
    metadata?: any;
  }) {
    try {
      await this.notificationService.sendNotification({
        userId: payload.userId,
        title: payload.title,
        content: payload.content,
        notificationType: payload.notificationType || 'system',
        metadata: payload.metadata,
      });
    } catch (error) {
      console.error('发送系统通知失败:', error);
    }
  }
}
