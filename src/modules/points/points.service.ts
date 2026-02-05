import { Injectable, NotFoundException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { PointsTransaction } from './entities/points-transaction.entity';
import { PointsRule } from './entities/points-rule.entity';
import { PointsTask } from './entities/points-task.entity';
import { PointsTaskRecord } from './entities/points-task-record.entity';
import { User } from '../user/entities/user.entity';
import { AddPointsDto } from './dto/add-points.dto';
import { SpendPointsDto } from './dto/spend-points.dto';
import { QueryPointsTransactionDto } from './dto/query-points-transaction.dto';
import { CreatePointsRuleDto } from './dto/create-points-rule.dto';
import { UpdatePointsRuleDto } from './dto/update-points-rule.dto';
import { CreatePointsTaskDto } from './dto/create-points-task.dto';
import { UpdatePointsTaskDto } from './dto/update-points-task.dto';
import { ListUtil } from 'src/common/utils';
import { POINTS_RULES_SEED, POINTS_TASKS_SEED } from './points-rules.seed';

@Injectable()
export class PointsService implements OnModuleInit {
  constructor(
    @InjectRepository(PointsTransaction)
    private pointsTransactionRepository: Repository<PointsTransaction>,
    @InjectRepository(PointsRule)
    private pointsRuleRepository: Repository<PointsRule>,
    @InjectRepository(PointsTask)
    private pointsTaskRepository: Repository<PointsTask>,
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
      // 初始化积分规则
      for (const ruleData of POINTS_RULES_SEED) {
        const existingRule = await this.pointsRuleRepository.findOne({
          where: { code: ruleData.code },
        });

        if (!existingRule) {
          const rule = this.pointsRuleRepository.create(ruleData);
          await this.pointsRuleRepository.save(rule);
          console.log(`✅ 初始化积分规则: ${ruleData.name}`);
        }
      }

      // 初始化积分任务
      for (const taskData of POINTS_TASKS_SEED) {
        const existingTask = await this.pointsTaskRepository.findOne({
          where: { code: taskData.code },
        });

        if (!existingTask) {
          const task = this.pointsTaskRepository.create({
            code: taskData.code,
            name: taskData.name,
            description: taskData.description,
            type: taskData.type as 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ONCE',
            rewardPoints: taskData.rewardPoints,
            targetCount: taskData.targetCount,
            icon: taskData.icon,
            link: taskData.link || undefined,
            isActive: taskData.isActive,
            sort: taskData.sort,
          });
          await this.pointsTaskRepository.save(task);
          console.log(`✅ 初始化积分任务: ${taskData.name}`);
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

    // 更新用户积分
    user.score += amount;
    await this.userRepository.save(user);

    // 创建交易记录
    const transaction = this.pointsTransactionRepository.create({
      userId,
      amount,
      balance: user.score,
      type: 'EARN',
      source,
      description,
      relatedType,
      relatedId,
      ...(expiredAt && { expiredAt }),
    });

    await this.pointsTransactionRepository.save(transaction);

    return {
      success: true,
      message: 'response.success.pointsAdd',
      data: {
        amount,
        balance: user.score,
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

    // 检查积分是否足够
    if (user.score < amount) {
      throw new BadRequestException('response.error.insufficientPoints');
    }

    // 更新用户积分
    user.score -= amount;
    await this.userRepository.save(user);

    // 创建交易记录
    const transaction = this.pointsTransactionRepository.create({
      userId,
      amount: -amount,
      balance: user.score,
      type: 'SPEND',
      source,
      description,
      relatedType,
      relatedId,
    });

    await this.pointsTransactionRepository.save(transaction);

    return {
      success: true,
      message: 'response.success.pointsSpend',
      data: {
        amount,
        balance: user.score,
        transaction,
      },
    };
  }

  /**
   * 根据规则增加积分
   */
  async addPointsByRule(userId: number, ruleCode: string, relatedType?: string, relatedId?: number) {
    const rule = await this.pointsRuleRepository.findOne({ where: { code: ruleCode, isActive: true } });
    if (!rule) {
      throw new NotFoundException('response.error.pointsRuleNotFound');
    }

    // 检查每日限制
    if (rule.dailyLimit > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const count = await this.pointsTransactionRepository.count({
        where: {
          userId,
          source: ruleCode,
          createdAt: MoreThan(today),
        },
      });

      if (count >= rule.dailyLimit) {
        throw new BadRequestException('response.error.pointsDailyLimitReached');
      }
    }

    // 检查总限制
    if (rule.totalLimit > 0) {
      const count = await this.pointsTransactionRepository.count({
        where: {
          userId,
          source: ruleCode,
        },
      });

      if (count >= rule.totalLimit) {
        throw new BadRequestException('response.error.pointsTotalLimitReached');
      }
    }

    return await this.addPoints(userId, {
      amount: rule.points,
      source: ruleCode,
      description: rule.name,
      relatedType,
      relatedId,
      validDays: rule.validDays,
    });
  }

  /**
   * 获取积分交易记录
   */
  async getTransactions(userId: number, queryDto: QueryPointsTransactionDto) {
    const { page = 1, limit = 10, type, source } = queryDto;

    const queryBuilder = this.pointsTransactionRepository
      .createQueryBuilder('transaction')
      .where('transaction.userId = :userId', { userId });

    if (type) {
      queryBuilder.andWhere('transaction.type = :type', { type });
    }

    if (source) {
      queryBuilder.andWhere('transaction.source = :source', { source });
    }

    queryBuilder.orderBy('transaction.createdAt', 'DESC');

    const [data, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return ListUtil.buildPaginatedList(data, total, page, limit);
  }

  /**
   * 获取积分统计
   */
  async getPointsStats(userId: number) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('response.error.userNotExist');
    }

    // 总获得积分
    const totalEarned = await this.pointsTransactionRepository
      .createQueryBuilder('transaction')
      .select('SUM(transaction.amount)', 'total')
      .where('transaction.userId = :userId', { userId })
      .andWhere('transaction.type = :type', { type: 'EARN' })
      .getRawOne();

    // 总消费积分
    const totalSpent = await this.pointsTransactionRepository
      .createQueryBuilder('transaction')
      .select('SUM(ABS(transaction.amount))', 'total')
      .where('transaction.userId = :userId', { userId })
      .andWhere('transaction.type = :type', { type: 'SPEND' })
      .getRawOne();

    // 即将过期的积分
    const expiringPoints = await this.pointsTransactionRepository
      .createQueryBuilder('transaction')
      .select('SUM(transaction.amount)', 'total')
      .where('transaction.userId = :userId', { userId })
      .andWhere('transaction.expiredAt IS NOT NULL')
      .andWhere('transaction.expiredAt > NOW()')
      .andWhere('transaction.expiredAt <= DATE_ADD(NOW(), INTERVAL 30 DAY)')
      .getRawOne();

    return {
      currentBalance: user.score,
      totalEarned: parseInt(totalEarned?.total || '0'),
      totalSpent: parseInt(totalSpent?.total || '0'),
      expiringPoints: parseInt(expiringPoints?.total || '0'),
    };
  }

  // ==================== 积分规则管理 ====================

  async createRule(createRuleDto: CreatePointsRuleDto) {
    const existingRule = await this.pointsRuleRepository.findOne({
      where: { code: createRuleDto.code },
    });

    if (existingRule) {
      throw new BadRequestException('response.error.pointsRuleCodeExists');
    }

    const rule = this.pointsRuleRepository.create(createRuleDto);
    const savedRule = await this.pointsRuleRepository.save(rule);

    return {
      success: true,
      message: 'response.success.pointsRuleCreate',
      data: savedRule,
    };
  }

  async findAllRules() {
    const rules = await this.pointsRuleRepository.find({
      order: { sort: 'ASC', createdAt: 'DESC' },
    });
    return ListUtil.buildSimpleList(rules);
  }

  async findOneRule(id: number) {
    const rule = await this.pointsRuleRepository.findOne({ where: { id } });
    if (!rule) {
      throw new NotFoundException('response.error.pointsRuleNotFound');
    }
    return rule;
  }

  async updateRule(id: number, updateRuleDto: UpdatePointsRuleDto) {
    const rule = await this.findOneRule(id);

    if (updateRuleDto.code && updateRuleDto.code !== rule.code) {
      const existingRule = await this.pointsRuleRepository.findOne({
        where: { code: updateRuleDto.code },
      });
      if (existingRule) {
        throw new BadRequestException('response.error.pointsRuleCodeExists');
      }
    }

    Object.assign(rule, updateRuleDto);
    const updatedRule = await this.pointsRuleRepository.save(rule);

    return {
      success: true,
      message: 'response.success.pointsRuleUpdate',
      data: updatedRule,
    };
  }

  async removeRule(id: number) {
    const rule = await this.findOneRule(id);
    await this.pointsRuleRepository.remove(rule);

    return {
      success: true,
      message: 'response.success.pointsRuleDelete',
    };
  }

  // ==================== 积分任务管理 ====================

  async createTask(createTaskDto: CreatePointsTaskDto) {
    const existingTask = await this.pointsTaskRepository.findOne({
      where: { code: createTaskDto.code },
    });

    if (existingTask) {
      throw new BadRequestException('response.error.pointsTaskCodeExists');
    }

    const task = this.pointsTaskRepository.create(createTaskDto);
    const savedTask = await this.pointsTaskRepository.save(task);

    return {
      success: true,
      message: 'response.success.pointsTaskCreate',
      data: savedTask,
    };
  }

  async findAllTasks(userId?: number) {
    const tasks = await this.pointsTaskRepository.find({
      where: { isActive: true },
      order: { sort: 'ASC', createdAt: 'DESC' },
    });

    if (!userId) {
      return ListUtil.buildSimpleList(tasks);
    }

    // 获取用户任务进度
    const tasksWithProgress = await Promise.all(
      tasks.map(async (task) => {
        const record = await this.getOrCreateTaskRecord(userId, task);
        return {
          ...task,
          progress: record.progress,
          targetCount: record.targetCount,
          isCompleted: record.isCompleted,
          isRewarded: record.isRewarded,
        };
      }),
    );

    return ListUtil.buildSimpleList(tasksWithProgress);
  }

  async findOneTask(id: number) {
    const task = await this.pointsTaskRepository.findOne({ where: { id } });
    if (!task) {
      throw new NotFoundException('response.error.pointsTaskNotFound');
    }
    return task;
  }

  async updateTask(id: number, updateTaskDto: UpdatePointsTaskDto) {
    const task = await this.findOneTask(id);

    if (updateTaskDto.code && updateTaskDto.code !== task.code) {
      const existingTask = await this.pointsTaskRepository.findOne({
        where: { code: updateTaskDto.code },
      });
      if (existingTask) {
        throw new BadRequestException('response.error.pointsTaskCodeExists');
      }
    }

    Object.assign(task, updateTaskDto);
    const updatedTask = await this.pointsTaskRepository.save(task);

    return {
      success: true,
      message: 'response.success.pointsTaskUpdate',
      data: updatedTask,
    };
  }

  async removeTask(id: number) {
    const task = await this.findOneTask(id);
    await this.pointsTaskRepository.remove(task);

    return {
      success: true,
      message: 'response.success.pointsTaskDelete',
    };
  }

  /**
   * 更新任务进度
   */
  async updateTaskProgress(userId: number, taskCode: string, increment: number = 1) {
    const task = await this.pointsTaskRepository.findOne({
      where: { code: taskCode, isActive: true },
    });

    if (!task) {
      return { success: false };
    }

    const record = await this.getOrCreateTaskRecord(userId, task);

    // 如果已完成，不再更新
    if (record.isCompleted) {
      return { success: false };
    }

    record.progress += increment;

    // 检查是否完成
    if (record.progress >= record.targetCount) {
      record.progress = record.targetCount;
      record.isCompleted = true;
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
  async claimTaskReward(userId: number, taskId: number) {
    const task = await this.findOneTask(taskId);
    const record = await this.pointsTaskRecordRepository.findOne({
      where: { userId, taskId },
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
      amount: record.rewardPoints,
      source: `TASK_${task.code}`,
      description: `完成任务：${task.name}`,
      relatedType: 'TASK',
      relatedId: taskId,
    });

    // 更新记录
    record.isRewarded = true;
    record.rewardedAt = new Date();
    await this.pointsTaskRecordRepository.save(record);

    return {
      success: true,
      message: 'response.success.pointsTaskRewardClaimed',
      data: {
        rewardPoints: record.rewardPoints,
      },
    };
  }

  /**
   * 获取或创建任务记录
   */
  private async getOrCreateTaskRecord(userId: number, task: PointsTask) {
    let record = await this.pointsTaskRecordRepository.findOne({
      where: { userId, taskId: task.id },
    });

    if (!record) {
      record = this.pointsTaskRecordRepository.create({
        userId,
        taskId: task.id,
        progress: 0,
        targetCount: task.targetCount,
        rewardPoints: task.rewardPoints,
      });
      await this.pointsTaskRecordRepository.save(record);
    }

    return record;
  }
}
