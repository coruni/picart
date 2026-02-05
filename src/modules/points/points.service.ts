import { Injectable, NotFoundException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { PointsTransaction } from './entities/points-transaction.entity';
import { PointsActivity } from './entities/points-activity.entity';
import { PointsTaskRecord } from './entities/points-task-record.entity';
import { User } from '../user/entities/user.entity';
import { AddPointsDto } from './dto/add-points.dto';
import { SpendPointsDto } from './dto/spend-points.dto';
import { QueryPointsTransactionDto } from './dto/query-points-transaction.dto';
import { ListUtil } from 'src/common/utils';
import { POINTS_ACTIVITIES_SEED } from './points-activities.seed';

@Injectable()
export class PointsService implements OnModuleInit {
  constructor(
    @InjectRepository(PointsTransaction)
    private pointsTransactionRepository: Repository<PointsTransaction>,
    @InjectRepository(PointsActivity)
    private pointsActivityRepository: Repository<PointsActivity>,
    @InjectRepository(PointsTaskRecord)
    private pointsTaskRecordRepository: Repository<PointsTaskRecord>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async onModuleInit() {
    await this.initializeSeedData();
  }

  /**
   * 初始化种子数据
   */
  private async initializeSeedData() {
    try {
      // 初始化积分活动
      for (const activityData of POINTS_ACTIVITIES_SEED) {
        const existingActivity = await this.pointsActivityRepository.findOne({
          where: { code: activityData.code },
        });

        if (!existingActivity) {
          const activity = this.pointsActivityRepository.create({
            code: activityData.code,
            name: activityData.name,
            description: activityData.description,
            type: activityData.type as 'INSTANT' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ONCE',
            rewardPoints: activityData.rewardPoints,
            targetCount: activityData.targetCount,
            dailyLimit: activityData.dailyLimit,
            totalLimit: activityData.totalLimit,
            validDays: activityData.validDays,
            icon: activityData.icon,
            link: activityData.link || undefined,
            isActive: activityData.isActive,
            sort: activityData.sort,
          });
          await this.pointsActivityRepository.save(activity);
          console.log(`✅ 初始化积分活动: ${activityData.name}`);
        }
      }

      console.log('🎯 积分系统种子数据初始化完成');
    } catch (error) {
      console.error('❌ 积分系统种子数据初始化失败:', error);
    }
  }

  /**
   * 增加积分
   */
  async addPoints(userId: number, addPointsDto: AddPointsDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('response.error.userNotExist');
    }

    const { amount, source, description, relatedType, relatedId, validDays = 0 } = addPointsDto;

    // 计算过期时间
    let expiredAt: Date | undefined = undefined;
    if (validDays > 0) {
      expiredAt = new Date();
      expiredAt.setDate(expiredAt.getDate() + validDays);
    }

    // 创建积分交易记录
    const transaction = this.pointsTransactionRepository.create({
      userId,
      amount,
      type: 'EARN',
      source,
      description,
      relatedType,
      relatedId,
      expiredAt,
    });

    await this.pointsTransactionRepository.save(transaction);

    // 更新用户积分
    user.points += amount;
    await this.userRepository.save(user);

    return {
      success: true,
      message: 'response.success.pointsAdd',
      data: {
        amount,
        currentPoints: user.points,
        transaction,
      },
    };
  }

  /**
   * 消费积分
   */
  async spendPoints(userId: number, spendPointsDto: SpendPointsDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('response.error.userNotExist');
    }

    const { amount, source, description, relatedType, relatedId } = spendPointsDto;

    if (user.points < amount) {
      throw new BadRequestException('response.error.pointsInsufficient');
    }

    // 创建积分交易记录
    const transaction = this.pointsTransactionRepository.create({
      userId,
      amount: -amount,
      type: 'SPEND',
      source,
      description,
      relatedType,
      relatedId,
    });

    await this.pointsTransactionRepository.save(transaction);

    // 更新用户积分
    user.points -= amount;
    await this.userRepository.save(user);

    return {
      success: true,
      message: 'response.success.pointsSpend',
      data: {
        amount,
        currentPoints: user.points,
        transaction,
      },
    };
  }

  /**
   * 根据活动增加积分
   */
  async addPointsByRule(userId: number, activityCode: string, relatedType?: string, relatedId?: number) {
    const activity = await this.pointsActivityRepository.findOne({ 
      where: { code: activityCode, isActive: true } 
    });
    if (!activity) {
      throw new NotFoundException('response.error.pointsActivityNotFound');
    }

    // 检查每日限制
    if (activity.dailyLimit > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const count = await this.pointsTransactionRepository.count({
        where: {
          userId,
          source: activityCode,
          createdAt: MoreThan(today),
        },
      });

      if (count >= activity.dailyLimit) {
        throw new BadRequestException('response.error.pointsDailyLimitReached');
      }
    }

    // 检查总限制
    if (activity.totalLimit > 0) {
      const count = await this.pointsTransactionRepository.count({
        where: {
          userId,
          source: activityCode,
        },
      });

      if (count >= activity.totalLimit) {
        throw new BadRequestException('response.error.pointsTotalLimitReached');
      }
    }

    return await this.addPoints(userId, {
      amount: activity.rewardPoints,
      source: activityCode,
      description: activity.name,
      relatedType,
      relatedId,
      validDays: activity.validDays,
    });
  }

  /**
   * 获取积分交易记录
   */
  async getTransactions(userId: number, queryDto: QueryPointsTransactionDto) {
    const { page = 1, limit = 10, type, source } = queryDto;
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (type) where.type = type;
    if (source) where.source = source;

    const [transactions, total] = await this.pointsTransactionRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return ListUtil.buildPaginatedList(transactions, total, page, limit);
  }

  /**
   * 获取用户积分余额
   */
  async getBalance(userId: number) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('response.error.userNotExist');
    }

    return {
      points: user.points,
      userId,
    };
  }

  // ==================== 积分活动管理 ====================

  async createActivity(createActivityDto: any) {
    const existingActivity = await this.pointsActivityRepository.findOne({
      where: { code: createActivityDto.code },
    });

    if (existingActivity) {
      throw new BadRequestException('response.error.pointsActivityCodeExists');
    }

    const activity = this.pointsActivityRepository.create(createActivityDto);
    const savedActivity = await this.pointsActivityRepository.save(activity);

    return {
      success: true,
      message: 'response.success.pointsActivityCreate',
      data: savedActivity,
    };
  }

  async findAllActivities(type?: string) {
    const where: any = { isActive: true };
    if (type) {
      where.type = type;
    }

    const activities = await this.pointsActivityRepository.find({
      where,
      order: { sort: 'ASC', createdAt: 'DESC' },
    });

    return activities;
  }

  async findOneActivity(id: number) {
    const activity = await this.pointsActivityRepository.findOne({ where: { id } });
    if (!activity) {
      throw new NotFoundException('response.error.pointsActivityNotFound');
    }
    return activity;
  }

  async updateActivity(id: number, updateActivityDto: any) {
    const activity = await this.findOneActivity(id);

    if (updateActivityDto.code && updateActivityDto.code !== activity.code) {
      const existingActivity = await this.pointsActivityRepository.findOne({
        where: { code: updateActivityDto.code },
      });
      if (existingActivity) {
        throw new BadRequestException('response.error.pointsActivityCodeExists');
      }
    }

    Object.assign(activity, updateActivityDto);
    const updatedActivity = await this.pointsActivityRepository.save(activity);

    return {
      success: true,
      message: 'response.success.pointsActivityUpdate',
      data: updatedActivity,
    };
  }

  async removeActivity(id: number) {
    const activity = await this.findOneActivity(id);
    await this.pointsActivityRepository.remove(activity);

    return {
      success: true,
      message: 'response.success.pointsActivityDelete',
    };
  }

  /**
   * 更新任务进度（仅适用于周期性任务）
   */
  async updateTaskProgress(userId: number, activityCode: string, increment: number = 1) {
    const activity = await this.pointsActivityRepository.findOne({
      where: { code: activityCode, isActive: true },
    });

    if (!activity || activity.type === 'INSTANT') {
      return; // 即时活动不需要进度跟踪
    }

    let record = await this.getOrCreateTaskRecord(userId, activity);

    record.currentCount += increment;
    record.isCompleted = record.currentCount >= activity.targetCount;

    if (record.isCompleted && !record.completedAt) {
      record.completedAt = new Date();
    }

    await this.pointsTaskRecordRepository.save(record);

    return {
      success: true,
      data: record,
    };
  }

  /**
   * 领取任务奖励
   */
  async claimTaskReward(userId: number, activityId: number) {
    const activity = await this.findOneActivity(activityId);
    const record = await this.pointsTaskRecordRepository.findOne({
      where: { userId, taskId: activityId },
    });

    if (!record) {
      throw new NotFoundException('response.error.pointsTaskRecordNotFound');
    }

    if (!record.isCompleted) {
      throw new BadRequestException('response.error.pointsTaskNotCompleted');
    }

    if (record.isRewarded) {
      throw new BadRequestException('response.error.pointsTaskAlreadyRewarded');
    }

    // 发放奖励
    await this.addPoints(userId, {
      amount: activity.rewardPoints,
      source: activity.code,
      description: `任务奖励：${activity.name}`,
      validDays: activity.validDays,
    });

    record.isRewarded = true;
    record.rewardedAt = new Date();
    await this.pointsTaskRecordRepository.save(record);

    return {
      success: true,
      message: 'response.success.pointsTaskRewardClaimed',
      data: {
        rewardPoints: activity.rewardPoints,
      },
    };
  }

  /**
   * 获取或创建任务记录
   */
  private async getOrCreateTaskRecord(userId: number, activity: any) {
    let record = await this.pointsTaskRecordRepository.findOne({
      where: { userId, taskId: activity.id },
    });

    if (!record) {
      record = this.pointsTaskRecordRepository.create({
        userId,
        taskId: activity.id,
        currentCount: 0,
        targetCount: activity.targetCount,
        rewardPoints: activity.rewardPoints,
        isCompleted: false,
        isRewarded: false,
      });
    }

    return record;
  }

  // ==================== 任务记录查询 ====================

  /**
   * 获取用户的所有任务记录
   */
  async getUserTaskRecords(userId: number) {
    const records = await this.pointsTaskRecordRepository.find({
      where: { userId },
      relations: ['task'],
      order: { createdAt: 'DESC' },
    });

    return records;
  }

  /**
   * 获取用户指定活动的任务记录
   */
  async getUserTaskRecord(userId: number, activityId: number) {
    const record = await this.pointsTaskRecordRepository.findOne({
      where: { userId, taskId: activityId },
      relations: ['task'],
    });

    if (!record) {
      throw new NotFoundException('response.error.pointsTaskRecordNotFound');
    }

    return record;
  }

  // ==================== 管理员查询接口 ====================

  /**
   * 获取所有用户的积分交易记录（管理员）
   */
  async getAllTransactions(queryDto: QueryPointsTransactionDto) {
    const { page = 1, limit = 10, type, source } = queryDto;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (type) where.type = type;
    if (source) where.source = source;

    const [transactions, total] = await this.pointsTransactionRepository.findAndCount({
      where,
      relations: ['user'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return ListUtil.buildPaginatedList(transactions, total, page, limit);
  }

  /**
   * 获取积分系统统计数据
   */
  async getStatistics() {
    // 总积分交易数
    const totalTransactions = await this.pointsTransactionRepository.count();
    
    // 按类型统计
    const earnTransactions = await this.pointsTransactionRepository.count({
      where: { type: 'EARN' },
    });
    const spendTransactions = await this.pointsTransactionRepository.count({
      where: { type: 'SPEND' },
    });

    // 总积分发放量
    const totalEarned = await this.pointsTransactionRepository
      .createQueryBuilder('transaction')
      .select('SUM(transaction.amount)', 'total')
      .where('transaction.type = :type', { type: 'EARN' })
      .getRawOne();

    // 总积分消费量
    const totalSpent = await this.pointsTransactionRepository
      .createQueryBuilder('transaction')
      .select('SUM(ABS(transaction.amount))', 'total')
      .where('transaction.type = :type', { type: 'SPEND' })
      .getRawOne();

    // 活跃用户数（有积分交易的用户）
    const activeUsers = await this.pointsTransactionRepository
      .createQueryBuilder('transaction')
      .select('COUNT(DISTINCT transaction.userId)', 'count')
      .getRawOne();

    // 按来源统计积分获取
    const bySource = await this.pointsTransactionRepository
      .createQueryBuilder('transaction')
      .select('transaction.source', 'source')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(transaction.amount)', 'total')
      .where('transaction.type = :type', { type: 'EARN' })
      .groupBy('transaction.source')
      .orderBy('total', 'DESC')
      .getRawMany();

    // 活动统计
    const totalActivities = await this.pointsActivityRepository.count();
    const activeActivities = await this.pointsActivityRepository.count({
      where: { isActive: true },
    });

    // 任务完成统计
    const totalTaskRecords = await this.pointsTaskRecordRepository.count();
    const completedTasks = await this.pointsTaskRecordRepository.count({
      where: { isCompleted: true },
    });
    const claimedRewards = await this.pointsTaskRecordRepository.count({
      where: { isRewarded: true },
    });

    return {
      transactions: {
        total: totalTransactions,
        earned: earnTransactions,
        spent: spendTransactions,
      },
      points: {
        totalEarned: parseInt(totalEarned?.total || '0'),
        totalSpent: parseInt(totalSpent?.total || '0'),
      },
      users: {
        activeUsers: parseInt(activeUsers?.count || '0'),
      },
      activities: {
        total: totalActivities,
        active: activeActivities,
      },
      tasks: {
        totalRecords: totalTaskRecords,
        completed: completedTasks,
        claimed: claimedRewards,
        completionRate: totalTaskRecords > 0 ? (completedTasks / totalTaskRecords * 100).toFixed(2) : '0',
        claimRate: completedTasks > 0 ? (claimedRewards / completedTasks * 100).toFixed(2) : '0',
      },
      bySource,
    };
  }
}