import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AchievementService } from './achievement.service';

@Injectable()
export class AchievementEventService {
  constructor(private achievementService: AchievementService) {}

  /**
   * 监听文章创建事件
   */
  @OnEvent('article.created')
  async handleArticleCreated(payload: { userId: number; articleId: number }) {
    try {
      // 第一篇文章
      await this.achievementService.updateProgress(payload.userId, 'FIRST_ARTICLE', 1);
      // 发布10篇文章
      await this.achievementService.updateProgress(payload.userId, 'ARTICLE_10', 1);
      // 发布50篇文章
      await this.achievementService.updateProgress(payload.userId, 'ARTICLE_50', 1);
      // 发布100篇文章
      await this.achievementService.updateProgress(payload.userId, 'ARTICLE_100', 1);
    } catch (error) {
      console.error('处理文章创建成就失败:', error);
    }
  }

  /**
   * 监听文章被点赞事件
   */
  @OnEvent('article.receivedLike')
  async handleArticleReceivedLike(payload: { authorId: number; articleId: number; likerId: number }) {
    try {
      // 获得第一个点赞
      await this.achievementService.updateProgress(payload.authorId, 'FIRST_LIKE', 1);
      // 获得100个点赞
      await this.achievementService.updateProgress(payload.authorId, 'LIKE_100', 1);
      // 获得1000个点赞
      await this.achievementService.updateProgress(payload.authorId, 'LIKE_1000', 1);
    } catch (error) {
      console.error('处理文章点赞成就失败:', error);
    }
  }

  /**
   * 监听评论创建事件
   */
  @OnEvent('comment.created')
  async handleCommentCreated(payload: { userId: number; articleId: number; commentId: number }) {
    try {
      // 第一条评论
      await this.achievementService.updateProgress(payload.userId, 'FIRST_COMMENT', 1);
      // 发表100条评论
      await this.achievementService.updateProgress(payload.userId, 'COMMENT_100', 1);
    } catch (error) {
      console.error('处理评论创建成就失败:', error);
    }
  }

  /**
   * 监听用户关注事件
   */
  @OnEvent('user.followed')
  async handleUserFollowed(payload: { userId: number; targetUserId: number }) {
    try {
      // 第一个关注
      await this.achievementService.updateProgress(payload.userId, 'FIRST_FOLLOW', 1);
      // 关注10个用户
      await this.achievementService.updateProgress(payload.userId, 'FOLLOW_10', 1);
    } catch (error) {
      console.error('处理关注成就失败:', error);
    }
  }

  /**
   * 监听用户被关注事件
   */
  @OnEvent('user.receivedFollow')
  async handleUserReceivedFollow(payload: { userId: number; followerId: number }) {
    try {
      // 获得第一个粉丝
      await this.achievementService.updateProgress(payload.userId, 'FIRST_FOLLOWER', 1);
      // 获得100个粉丝
      await this.achievementService.updateProgress(payload.userId, 'FOLLOWER_100', 1);
      // 获得1000个粉丝
      await this.achievementService.updateProgress(payload.userId, 'FOLLOWER_1000', 1);
    } catch (error) {
      console.error('处理被关注成就失败:', error);
    }
  }

  /**
   * 监听每日登录事件
   */
  @OnEvent('user.dailyLogin')
  async handleDailyLogin(payload: { userId: number; consecutiveDays?: number }) {
    try {
      // 连续登录7天
      if (payload.consecutiveDays && payload.consecutiveDays >= 7) {
        await this.achievementService.updateProgress(payload.userId, 'LOGIN_7_DAYS', 1);
      }
      // 连续登录30天
      if (payload.consecutiveDays && payload.consecutiveDays >= 30) {
        await this.achievementService.updateProgress(payload.userId, 'LOGIN_30_DAYS', 1);
      }
    } catch (error) {
      console.error('处理每日登录成就失败:', error);
    }
  }

  /**
   * 监听用户升级事件
   */
  @OnEvent('user.levelUp')
  async handleUserLevelUp(payload: { userId: number; level: number }) {
    try {
      // 达到10级
      if (payload.level >= 10) {
        await this.achievementService.updateProgress(payload.userId, 'LEVEL_10', 1);
      }
      // 达到30级
      if (payload.level >= 30) {
        await this.achievementService.updateProgress(payload.userId, 'LEVEL_30', 1);
      }
      // 达到50级
      if (payload.level >= 50) {
        await this.achievementService.updateProgress(payload.userId, 'LEVEL_50', 1);
      }
    } catch (error) {
      console.error('处理升级成就失败:', error);
    }
  }

  /**
   * 监听会员购买事件
   */
  @OnEvent('membership.purchased')
  async handleMembershipPurchased(payload: { userId: number; orderId: number }) {
    try {
      // 成为会员
      await this.achievementService.updateProgress(payload.userId, 'BECOME_MEMBER', 1);
    } catch (error) {
      console.error('处理会员购买成就失败:', error);
    }
  }

  /**
   * 监听资料完善事件
   */
  @OnEvent('user.profileCompleted')
  async handleProfileCompleted(payload: { userId: number }) {
    try {
      // 完善个人资料
      await this.achievementService.updateProgress(payload.userId, 'PROFILE_COMPLETED', 1);
    } catch (error) {
      console.error('处理资料完善成就失败:', error);
    }
  }
}
