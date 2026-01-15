import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { LevelTransaction } from './entities/level-transaction.entity';

@Injectable()
export class LevelService {
  // 等级配置：每个等级需要的总经验值（最高6级）
  private readonly LEVEL_CONFIG = [
    { level: 0, totalExp: 0 },
    { level: 1, totalExp: 100 },
    { level: 2, totalExp: 300 },
    { level: 3, totalExp: 600 },
    { level: 4, totalExp: 1000 },
    { level: 5, totalExp: 1500 },
    { level: 6, totalExp: 2100 },
  ];

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(LevelTransaction)
    private levelTransactionRepository: Repository<LevelTransaction>,
  ) {}

  /**
   * 增加经验值
   */
  async addExperience(
    userId: number,
    amount: number,
    source: string,
    description?: string,
    relatedType?: string,
    relatedId?: number,
  ) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('response.error.userNotExist');
    }

    const oldLevel = user.level;
    const oldExperience = user.experience;

    // 更新经验值
    user.experience += amount;

    // 计算新等级
    const newLevel = this.calculateLevel(user.experience);
    const leveledUp = newLevel > oldLevel;
    user.level = newLevel;

    await this.userRepository.save(user);

    // 创建交易记录
    const transaction = this.levelTransactionRepository.create({
      userId,
      amount,
      balance: user.experience,
      level: user.level,
      type: 'EARN',
      source,
      description,
      relatedType,
      relatedId,
    });

    await this.levelTransactionRepository.save(transaction);

    return {
      success: true,
      message: leveledUp ? 'response.success.levelUp' : 'response.success.experienceAdd',
      data: {
        amount,
        oldLevel,
        newLevel: user.level,
        leveledUp,
        experience: user.experience,
        nextLevelExp: this.getNextLevelExp(user.level),
        currentLevelExp: this.getCurrentLevelExp(user.experience, user.level),
        transaction,
      },
    };
  }

  /**
   * 根据总经验值计算等级
   */
  private calculateLevel(totalExp: number): number {
    for (let i = this.LEVEL_CONFIG.length - 1; i >= 0; i--) {
      if (totalExp >= this.LEVEL_CONFIG[i].totalExp) {
        return this.LEVEL_CONFIG[i].level;
      }
    }
    return 0;
  }

  /**
   * 获取下一级所需经验值
   */
  private getNextLevelExp(currentLevel: number): number {
    const nextLevelConfig = this.LEVEL_CONFIG.find((config) => config.level === currentLevel + 1);
    if (!nextLevelConfig) {
      return 0; // 已达到最高等级
    }
    const currentLevelConfig = this.LEVEL_CONFIG.find((config) => config.level === currentLevel);
    return nextLevelConfig.totalExp - (currentLevelConfig?.totalExp || 0);
  }

  /**
   * 获取当前等级的经验进度
   */
  private getCurrentLevelExp(totalExp: number, currentLevel: number): number {
    const currentLevelConfig = this.LEVEL_CONFIG.find((config) => config.level === currentLevel);
    return totalExp - (currentLevelConfig?.totalExp || 0);
  }

  /**
   * 获取用户等级信息
   */
  async getUserLevelInfo(userId: number) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('response.error.userNotExist');
    }

    const currentLevelConfig = this.LEVEL_CONFIG.find((config) => config.level === user.level);
    const nextLevelConfig = this.LEVEL_CONFIG.find((config) => config.level === user.level + 1);

    return {
      level: user.level,
      experience: user.experience,
      currentLevelExp: this.getCurrentLevelExp(user.experience, user.level),
      nextLevelExp: this.getNextLevelExp(user.level),
      nextLevelTotalExp: nextLevelConfig?.totalExp || 0,
      isMaxLevel: !nextLevelConfig,
      progress: nextLevelConfig
        ? (this.getCurrentLevelExp(user.experience, user.level) / this.getNextLevelExp(user.level)) * 100
        : 100,
    };
  }

  /**
   * 获取等级配置
   */
  getLevelConfig() {
    return this.LEVEL_CONFIG;
  }

  /**
   * 获取经验交易记录
   */
  async getTransactions(userId: number, page: number = 1, limit: number = 10) {
    const [data, total] = await this.levelTransactionRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
