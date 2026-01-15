import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { LevelService } from './level.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { LevelTransaction } from './entities/level-transaction.entity';

@Injectable()
export class LevelEventService {
  // 经验值配置（设计为每天最多12经验，需要约175天达到6级）
  // 每天最多：登录1次(5) + 发文章1篇(5) + 其他互动(2) = 12经验/天
  // 2100经验 ÷ 12经验/天 = 175天
  private readonly EXP_CONFIG = {
    PUBLISH_ARTICLE: 5, // 发布文章（每天1篇）
    ARTICLE_RECEIVED_LIKE: 1, // 文章被点赞（每天最多2次）
    ARTICLE_RECEIVED_COMMENT: 1, // 文章被评论（每天最多1次）
    PUBLISH_COMMENT: 1, // 发表评论（每天最多2次）
    COMMENT_RECEIVED_LIKE: 1, // 评论被点赞（每天最多1次）
    DAILY_LOGIN: 5, // 每日登录（每天1次）
    COMPLETE_PROFILE: 20, // 完善资料（一次性）
    FOLLOW_USER: 1, // 关注用户（每天最多1次）
    PURCHASE_MEMBERSHIP: 50, // 购买会员（偶尔）
  };

  // 每日限制配置
  private readonly DAILY_LIMITS = {
    PUBLISH_ARTICLE: 1, // 每天最多1篇文章获得经验
    ARTICLE_RECEIVED_LIKE: 2, // 每天最多2次文章被点赞获得经验
    ARTICLE_RECEIVED_COMMENT: 1, // 每天最多1次文章被评论获得经验
    PUBLISH_COMMENT: 2, // 每天最多2条评论获得经验
    COMMENT_RECEIVED_LIKE: 1, // 每天最多1次评论被点赞获得经验
    DAILY_LOGIN: 1, // 每天只能登录1次获得经验
    FOLLOW_USER: 1, // 每天最多1次关注获得经验
  };

  constructor(
    private readonly levelService: LevelService,
    @InjectRepository(LevelTransaction)
    private levelTransactionRepository: Repository<LevelTransaction>,
  ) {}

  /**
   * 检查今日该来源的经验获取次数
   */
  private async checkDailyLimit(userId: number, source: string): Promise<boolean> {
    const limit = this.DAILY_LIMITS[source];
    if (!limit) return true; // 没有限制的直接通过

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const count = await this.levelTransactionRepository.count({
      where: {
        userId,
        source,
        createdAt: MoreThan(today),
      },
    });

    return count < limit;
  }

  /**
   * 监听文章创建事件 - 发布文章获得经验
   */
  @OnEvent('article.created')
  async handleArticleCreated(payload: { userId: number; articleId: number }) {
    try {
      const canEarn = await this.checkDailyLimit(payload.userId, 'PUBLISH_ARTICLE');
      if (!canEarn) {
        console.log(`用户 ${payload.userId} 今日发布文章获得经验已达上限`);
        return;
      }

      await this.levelService.addExperience(
        payload.userId,
        this.EXP_CONFIG.PUBLISH_ARTICLE,
        'PUBLISH_ARTICLE',
        '发布文章',
        'ARTICLE',
        payload.articleId,
      );
      console.log(`用户 ${payload.userId} 发布文章获得 ${this.EXP_CONFIG.PUBLISH_ARTICLE} 经验`);
    } catch (error) {
      console.error('发布文章增加经验失败:', error.message);
    }
  }

  /**
   * 监听文章被点赞事件 - 文章作者获得经验
   */
  @OnEvent('article.receivedLike')
  async handleArticleReceivedLike(payload: { authorId: number; articleId: number; likerId: number }) {
    try {
      const canEarn = await this.checkDailyLimit(payload.authorId, 'ARTICLE_RECEIVED_LIKE');
      if (!canEarn) {
        console.log(`用户 ${payload.authorId} 今日文章被点赞获得经验已达上限`);
        return;
      }

      await this.levelService.addExperience(
        payload.authorId,
        this.EXP_CONFIG.ARTICLE_RECEIVED_LIKE,
        'ARTICLE_RECEIVED_LIKE',
        '文章被点赞',
        'ARTICLE',
        payload.articleId,
      );
      console.log(`用户 ${payload.authorId} 的文章被点赞获得 ${this.EXP_CONFIG.ARTICLE_RECEIVED_LIKE} 经验`);
    } catch (error) {
      console.error('文章被点赞增加经验失败:', error.message);
    }
  }

  /**
   * 监听文章被评论事件 - 文章作者获得经验
   */
  @OnEvent('article.receivedComment')
  async handleArticleReceivedComment(payload: {
    authorId: number;
    articleId: number;
    commenterId: number;
  }) {
    try {
      const canEarn = await this.checkDailyLimit(payload.authorId, 'ARTICLE_RECEIVED_COMMENT');
      if (!canEarn) {
        console.log(`用户 ${payload.authorId} 今日文章被评论获得经验已达上限`);
        return;
      }

      await this.levelService.addExperience(
        payload.authorId,
        this.EXP_CONFIG.ARTICLE_RECEIVED_COMMENT,
        'ARTICLE_RECEIVED_COMMENT',
        '文章被评论',
        'ARTICLE',
        payload.articleId,
      );
      console.log(`用户 ${payload.authorId} 的文章被评论获得 ${this.EXP_CONFIG.ARTICLE_RECEIVED_COMMENT} 经验`);
    } catch (error) {
      console.error('文章被评论增加经验失败:', error.message);
    }
  }

  /**
   * 监听评论创建事件 - 发表评论获得经验
   */
  @OnEvent('comment.created')
  async handleCommentCreated(payload: { userId: number; articleId: number; commentId: number }) {
    try {
      const canEarn = await this.checkDailyLimit(payload.userId, 'PUBLISH_COMMENT');
      if (!canEarn) {
        console.log(`用户 ${payload.userId} 今日发表评论获得经验已达上限`);
        return;
      }

      await this.levelService.addExperience(
        payload.userId,
        this.EXP_CONFIG.PUBLISH_COMMENT,
        'PUBLISH_COMMENT',
        '发表评论',
        'COMMENT',
        payload.commentId,
      );
      console.log(`用户 ${payload.userId} 发表评论获得 ${this.EXP_CONFIG.PUBLISH_COMMENT} 经验`);
    } catch (error) {
      console.error('发表评论增加经验失败:', error.message);
    }
  }

  /**
   * 监听评论被点赞事件 - 评论作者获得经验
   */
  @OnEvent('comment.receivedLike')
  async handleCommentReceivedLike(payload: { authorId: number; commentId: number; likerId: number }) {
    try {
      const canEarn = await this.checkDailyLimit(payload.authorId, 'COMMENT_RECEIVED_LIKE');
      if (!canEarn) {
        console.log(`用户 ${payload.authorId} 今日评论被点赞获得经验已达上限`);
        return;
      }

      await this.levelService.addExperience(
        payload.authorId,
        this.EXP_CONFIG.COMMENT_RECEIVED_LIKE,
        'COMMENT_RECEIVED_LIKE',
        '评论被点赞',
        'COMMENT',
        payload.commentId,
      );
      console.log(`用户 ${payload.authorId} 的评论被点赞获得 ${this.EXP_CONFIG.COMMENT_RECEIVED_LIKE} 经验`);
    } catch (error) {
      console.error('评论被点赞增加经验失败:', error.message);
    }
  }

  /**
   * 监听每日登录事件 - 每日登录获得经验
   */
  @OnEvent('user.dailyLogin')
  async handleDailyLogin(payload: { userId: number }) {
    try {
      const canEarn = await this.checkDailyLimit(payload.userId, 'DAILY_LOGIN');
      if (!canEarn) {
        console.log(`用户 ${payload.userId} 今日登录获得经验已达上限`);
        return;
      }

      await this.levelService.addExperience(
        payload.userId,
        this.EXP_CONFIG.DAILY_LOGIN,
        'DAILY_LOGIN',
        '每日登录',
      );
      console.log(`用户 ${payload.userId} 每日登录获得 ${this.EXP_CONFIG.DAILY_LOGIN} 经验`);
    } catch (error) {
      console.error('每日登录增加经验失败:', error.message);
    }
  }

  /**
   * 监听用户关注事件 - 关注用户获得经验
   */
  @OnEvent('user.followed')
  async handleUserFollowed(payload: { userId: number; targetUserId: number }) {
    try {
      const canEarn = await this.checkDailyLimit(payload.userId, 'FOLLOW_USER');
      if (!canEarn) {
        console.log(`用户 ${payload.userId} 今日关注用户获得经验已达上限`);
        return;
      }

      await this.levelService.addExperience(
        payload.userId,
        this.EXP_CONFIG.FOLLOW_USER,
        'FOLLOW_USER',
        '关注用户',
        'USER',
        payload.targetUserId,
      );
      console.log(`用户 ${payload.userId} 关注用户获得 ${this.EXP_CONFIG.FOLLOW_USER} 经验`);
    } catch (error) {
      console.error('关注用户增加经验失败:', error.message);
    }
  }

  /**
   * 监听会员购买事件 - 购买会员获得经验（无限制）
   */
  @OnEvent('membership.purchased')
  async handleMembershipPurchased(payload: { userId: number; orderId: number }) {
    try {
      await this.levelService.addExperience(
        payload.userId,
        this.EXP_CONFIG.PURCHASE_MEMBERSHIP,
        'PURCHASE_MEMBERSHIP',
        '购买会员',
        'ORDER',
        payload.orderId,
      );
      console.log(`用户 ${payload.userId} 购买会员获得 ${this.EXP_CONFIG.PURCHASE_MEMBERSHIP} 经验`);
    } catch (error) {
      console.error('购买会员增加经验失败:', error.message);
    }
  }

  /**
   * 监听资料完善事件 - 完善资料获得经验（一次性）
   */
  @OnEvent('user.profileCompleted')
  async handleProfileCompleted(payload: { userId: number }) {
    try {
      // 检查是否已经获得过完善资料的经验
      const hasEarned = await this.levelTransactionRepository.findOne({
        where: {
          userId: payload.userId,
          source: 'COMPLETE_PROFILE',
        },
      });

      if (hasEarned) {
        console.log(`用户 ${payload.userId} 已经获得过完善资料经验`);
        return;
      }

      await this.levelService.addExperience(
        payload.userId,
        this.EXP_CONFIG.COMPLETE_PROFILE,
        'COMPLETE_PROFILE',
        '完善资料',
      );
      console.log(`用户 ${payload.userId} 完善资料获得 ${this.EXP_CONFIG.COMPLETE_PROFILE} 经验`);
    } catch (error) {
      console.error('完善资料增加经验失败:', error.message);
    }
  }
}
