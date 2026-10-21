import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { AchievementService } from "./achievement.service";

@Injectable()
export class AchievementEventService {
  constructor(private achievementService: AchievementService) {}

  /**
   * 监听文章创建事件
   */
  @OnEvent("article.created")
  async handleArticleCreated(payload: { userId: number; articleId: number }) {
    try {
      await this.achievementService.updateProgressBatch(payload.userId, [
        "FIRST_ARTICLE",
        "ARTICLE_10",
        "ARTICLE_50",
        "ARTICLE_100",
      ]);
    } catch (error) {
      console.error("处理文章创建成就失败:", error);
    }
  }

  /**
   * 监听文章被点赞事件
   */
  @OnEvent("article.receivedLike")
  async handleArticleReceivedLike(payload: {
    authorId: number;
    articleId: number;
    likerId: number;
  }) {
    try {
      await this.achievementService.updateProgressBatch(payload.authorId, [
        "FIRST_LIKE",
        "LIKE_100",
        "LIKE_1000",
      ]);
    } catch (error) {
      console.error("处理文章点赞成就失败:", error);
    }
  }

  /**
   * 监听评论创建事件
   */
  @OnEvent("comment.created")
  async handleCommentCreated(payload: {
    userId: number;
    articleId: number;
    commentId: number;
  }) {
    try {
      await this.achievementService.updateProgressBatch(payload.userId, [
        "FIRST_COMMENT",
        "COMMENT_100",
      ]);
    } catch (error) {
      console.error("处理评论创建成就失败:", error);
    }
  }

  /**
   * 监听用户关注事件
   */
  @OnEvent("user.followed")
  async handleUserFollowed(payload: { userId: number; targetUserId: number }) {
    try {
      await this.achievementService.updateProgressBatch(payload.userId, [
        "FIRST_FOLLOW",
        "FOLLOW_10",
      ]);
    } catch (error) {
      console.error("处理关注成就失败:", error);
    }
  }

  /**
   * 监听用户被关注事件
   */
  @OnEvent("user.receivedFollow")
  async handleUserReceivedFollow(payload: {
    userId: number;
    followerId: number;
  }) {
    try {
      await this.achievementService.updateProgressBatch(payload.userId, [
        "FIRST_FOLLOWER",
        "FOLLOWER_100",
        "FOLLOWER_1000",
      ]);
    } catch (error) {
      console.error("处理被关注成就失败:", error);
    }
  }

  /**
   * 监听每日登录事件
   */
  @OnEvent("user.dailyLogin")
  async handleDailyLogin(payload: {
    userId: number;
    consecutiveDays?: number;
  }) {
    try {
      const codes: string[] = [];
      if (payload.consecutiveDays && payload.consecutiveDays >= 7) {
        codes.push("LOGIN_7_DAYS");
      }
      if (payload.consecutiveDays && payload.consecutiveDays >= 30) {
        codes.push("LOGIN_30_DAYS");
      }
      await this.achievementService.updateProgressBatch(payload.userId, codes);
    } catch (error) {
      console.error("处理每日登录成就失败:", error);
    }
  }

  /**
   * 监听用户升级事件
   */
  @OnEvent("user.levelUp")
  async handleUserLevelUp(payload: { userId: number; level: number }) {
    try {
      const codes: string[] = [];
      if (payload.level >= 10) {
        codes.push("LEVEL_10");
      }
      if (payload.level >= 30) {
        codes.push("LEVEL_30");
      }
      if (payload.level >= 50) {
        codes.push("LEVEL_50");
      }
      await this.achievementService.updateProgressBatch(payload.userId, codes);
    } catch (error) {
      console.error("处理升级成就失败:", error);
    }
  }

  /**
   * 监听会员购买事件
   */
  @OnEvent("membership.purchased")
  async handleMembershipPurchased(payload: {
    userId: number;
    orderId: number;
  }) {
    try {
      await this.achievementService.updateProgressBatch(payload.userId, [
        "BECOME_MEMBER",
      ]);
    } catch (error) {
      console.error("处理会员购买成就失败:", error);
    }
  }

  /**
   * 监听资料完善事件
   */
  @OnEvent("user.profileCompleted")
  async handleProfileCompleted(payload: { userId: number }) {
    try {
      await this.achievementService.updateProgressBatch(payload.userId, [
        "PROFILE_COMPLETED",
      ]);
    } catch (error) {
      console.error("处理资料完善成就失败:", error);
    }
  }
}
