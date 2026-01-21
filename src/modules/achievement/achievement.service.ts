import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Achievement } from './entities/achievement.entity';
import { UserAchievement } from './entities/user-achievement.entity';
import { CreateAchievementDto } from './dto/create-achievement.dto';
import { UpdateAchievementDto } from './dto/update-achievement.dto';
import { User } from '../user/entities/user.entity';
import { PointsService } from '../points/points.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Decoration } from '../decoration/entities/decoration.entity';
import { UserDecoration } from '../decoration/entities/user-decoration.entity';

@Injectable()
export class AchievementService {
  constructor(
    @InjectRepository(Achievement)
    private achievementRepository: Repository<Achievement>,
    @InjectRepository(UserAchievement)
    private userAchievementRepository: Repository<UserAchievement>,
    @InjectRepository(Decoration)
    private decorationRepository: Repository<Decoration>,
    @InjectRepository(UserDecoration)
    private userDecorationRepository: Repository<UserDecoration>,
    private pointsService: PointsService,
    private eventEmitter: EventEmitter2,
  ) { }

  /**
   * 创建成就
   */
  async create(createAchievementDto: CreateAchievementDto) {
    const achievement = this.achievementRepository.create(createAchievementDto);
    const saved = await this.achievementRepository.save(achievement);
    return {
      success: true,
      message: 'response.success.achievementCreate',
      data: saved,
    };
  }

  /**
   * 获取所有成就列表
   */
  async findAll(user?: User) {
    const achievements = await this.achievementRepository.find({
      where: { enabled: true },
      order: { sort: 'ASC', id: 'ASC' },
    });

    if (!user) {
      // 未登录用户只返回非隐藏成就
      return achievements.filter(a => !a.hidden);
    }

    // 获取用户的成就进度
    const userAchievements = await this.userAchievementRepository.find({
      where: { userId: user.id },
    });

    const userAchievementMap = new Map(
      userAchievements.map(ua => [ua.achievementId, ua])
    );

    // 合并成就和用户进度
    const result = achievements
      .filter(a => !a.hidden || userAchievementMap.has(a.id)) // 隐藏的成就只在用户有进度时显示
      .map(achievement => ({
        ...achievement,
        progress: userAchievementMap.get(achievement.id)?.progress || 0,
        completed: userAchievementMap.get(achievement.id)?.completed || false,
        completedAt: userAchievementMap.get(achievement.id)?.completedAt,
        claimed: userAchievementMap.get(achievement.id)?.claimed || false,
        claimedAt: userAchievementMap.get(achievement.id)?.claimedAt,
      }));

    return result;
  }

  /**
   * 获取用户成就统计
   */
  async getUserStats(userId: number) {
    const total = await this.achievementRepository.count({ where: { enabled: true } });
    const completed = await this.userAchievementRepository.count({
      where: { userId, completed: true },
    });
    const claimed = await this.userAchievementRepository.count({
      where: { userId, claimed: true },
    });

    return {
      total,
      completed,
      claimed,
      completionRate: total > 0 ? ((completed / total) * 100).toFixed(2) : '0.00',
    };
  }

  /**
   * 获取单个成就详情
   */
  async findOne(id: number, user?: User) {
    const achievement = await this.achievementRepository.findOne({
      where: { id },
    });

    if (!achievement) {
      throw new NotFoundException('response.error.achievementNotFound');
    }

    if (!user) {
      return achievement;
    }

    const userAchievement = await this.userAchievementRepository.findOne({
      where: { userId: user.id, achievementId: id },
    });

    return {
      ...achievement,
      progress: userAchievement?.progress || 0,
      completed: userAchievement?.completed || false,
      completedAt: userAchievement?.completedAt,
      claimed: userAchievement?.claimed || false,
      claimedAt: userAchievement?.claimedAt,
    };
  }

  /**
   * 更新成就
   */
  async update(id: number, updateAchievementDto: UpdateAchievementDto) {
    const achievement = await this.achievementRepository.findOne({ where: { id } });
    if (!achievement) {
      throw new NotFoundException('response.error.achievementNotFound');
    }

    Object.assign(achievement, updateAchievementDto);
    const updated = await this.achievementRepository.save(achievement);

    return {
      success: true,
      message: 'response.success.achievementUpdate',
      data: updated,
    };
  }

  /**
   * 删除成就
   */
  async remove(id: number) {
    const achievement = await this.achievementRepository.findOne({ where: { id } });
    if (!achievement) {
      throw new NotFoundException('response.error.achievementNotFound');
    }

    await this.achievementRepository.remove(achievement);
    return {
      success: true,
      message: 'response.success.achievementDelete',
    };
  }

  /**
   * 更新用户成就进度
   */
  async updateProgress(userId: number, achievementCode: string, increment: number = 1) {
    const achievement = await this.achievementRepository.findOne({
      where: { code: achievementCode, enabled: true },
    });

    if (!achievement) {
      return;
    }

    let userAchievement = await this.userAchievementRepository.findOne({
      where: { userId, achievementId: achievement.id },
    });

    if (!userAchievement) {
      userAchievement = this.userAchievementRepository.create({
        userId,
        achievementId: achievement.id,
        progress: 0,
      });
    }

    // 如果已完成，不再更新进度
    if (userAchievement.completed) {
      return;
    }

    userAchievement.progress += increment;

    // 检查是否达成条件
    const target = achievement.condition.target || 1;
    if (userAchievement.progress >= target) {
      userAchievement.completed = true;
      userAchievement.completedAt = new Date();

      // 自动为用户添加成就勋章装饰品
      await this.grantAchievementBadge(userId, achievement);

      // 触发成就完成事件
      this.eventEmitter.emit('achievement.completed', {
        userId,
        achievementId: achievement.id,
        achievementCode: achievement.code,
      });
    }

    await this.userAchievementRepository.save(userAchievement);
  }

  /**
   * 为用户授予成就勋章装饰品
   */
  private async grantAchievementBadge(userId: number, achievement: Achievement) {
    let decoration: Decoration | null = null;

    // 优先通过 achievementId 查找装饰品（最可靠的方式）
    decoration = await this.decorationRepository.findOne({
      where: {
        achievementId: achievement.id,
        type: 'ACHIEVEMENT_BADGE',
      },
    });

    // 如果没有找到，尝试通过成就的 rewardDecorationId 查找
    if (!decoration && achievement.rewardDecorationId) {
      decoration = await this.decorationRepository.findOne({
        where: { id: achievement.rewardDecorationId },
      });
    }

    // 如果还是没有找到，创建新的勋章装饰品
    if (!decoration) {
      const newDecoration = this.decorationRepository.create({
        name: achievement.name,
        type: 'ACHIEVEMENT_BADGE',
        description: achievement.description,
        imageUrl: achievement.icon || '/default-achievement-badge.png',
        previewUrl: achievement.icon || '/default-achievement-badge.png',
        rarity: achievement.rarity,
        obtainMethod: 'ACHIEVEMENT',
        isPurchasable: false,
        price: 0,
        isPermanent: true,
        validDays: null,
        sort: 0,
        status: 'ACTIVE',
        activityId: null,
        achievementId: achievement.id, // 关联成就ID，确保唯一性
        requiredLikes: 0,
        requiredComments: 0,
      });

      try {
        decoration = await this.decorationRepository.save(newDecoration);

        // 更新成就的装饰品ID
        achievement.rewardDecorationId = decoration.id;
        await this.achievementRepository.save(achievement);
      } catch (error: any) {
        // 如果因为唯一约束失败（并发创建），重新查询
        if (error.code === 'ER_DUP_ENTRY' || error.code === '23505') {
          decoration = await this.decorationRepository.findOne({
            where: {
              achievementId: achievement.id,
              type: 'ACHIEVEMENT_BADGE',
            },
          });
        } else {
          throw error;
        }
      }
    }

    // 确保装饰品存在
    if (!decoration) {
      console.error(`无法为成就 ${achievement.id} 创建或查找装饰品`);
      return;
    }

    // 检查用户是否已拥有该装饰品
    const existingUserDecoration = await this.userDecorationRepository.findOne({
      where: { userId, decorationId: decoration.id },
    });

    if (!existingUserDecoration) {
      // 为用户添加装饰品
      const userDecoration = this.userDecorationRepository.create({
        userId,
        decorationId: decoration.id,
        obtainMethod: 'ACHIEVEMENT',
        isPermanent: true,
        expiresAt: null,
        isUsing: false,
        giftFromUserId: null,
        orderId: null,
        activityId: null,
        remark: `完成成就：${achievement.name}`,
      });
      await this.userDecorationRepository.save(userDecoration);
    }
  }

  /**
   * 领取成就奖励
   */
  async claimReward(userId: number, achievementId: number) {
    const userAchievement = await this.userAchievementRepository.findOne({
      where: { userId, achievementId },
      relations: ['achievement'],
    });

    if (!userAchievement) {
      throw new NotFoundException('response.error.achievementNotFound');
    }

    if (!userAchievement.completed) {
      throw new Error('response.error.achievementNotCompleted');
    }

    if (userAchievement.claimed) {
      throw new Error('response.error.achievementAlreadyClaimed');
    }

    const achievement = userAchievement.achievement;

    // 发放积分奖励
    if (achievement.rewardPoints > 0) {
      await this.pointsService.addPoints(userId, {
        amount: achievement.rewardPoints,
        source: 'ACHIEVEMENT',
        description: `完成成就：${achievement.name}`,
        relatedType: 'achievement',
        relatedId: achievement.id,
      });
    }

    // 发放经验奖励（通过事件）
    if (achievement.rewardExp > 0) {
      this.eventEmitter.emit('user.gainExp', {
        userId,
        exp: achievement.rewardExp,
        reason: `完成成就：${achievement.name}`,
      });
    }

    // 发放装饰品奖励（通过事件）
    if (achievement.rewardDecorationId) {
      this.eventEmitter.emit('decoration.grant', {
        userId,
        decorationId: achievement.rewardDecorationId,
        obtainMethod: 'ACHIEVEMENT',
      });
    }

    // 标记为已领取
    userAchievement.claimed = true;
    userAchievement.claimedAt = new Date();
    await this.userAchievementRepository.save(userAchievement);

    return {
      success: true,
      message: 'response.success.achievementClaimed',
      data: {
        points: achievement.rewardPoints,
        exp: achievement.rewardExp,
        decorationId: achievement.rewardDecorationId,
      },
    };
  }

  /**
   * 批量领取奖励
   */
  async claimAllRewards(userId: number) {
    const userAchievements = await this.userAchievementRepository.find({
      where: { userId, completed: true, claimed: false },
      relations: ['achievement'],
    });

    const results: any[] = [];
    for (const ua of userAchievements) {
      try {
        const result = await this.claimReward(userId, ua.achievementId);
        results.push(result);
      } catch (error) {
        console.error(`领取成就 ${ua.achievementId} 奖励失败:`, error);
      }
    }

    return {
      success: true,
      message: 'response.success.achievementClaimedAll',
      data: {
        claimed: results.length,
        total: userAchievements.length,
      },
    };
  }
}
