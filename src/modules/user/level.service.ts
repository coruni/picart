import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { User } from "./entities/user.entity";
import { LevelTransaction } from "./entities/level-transaction.entity";

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
    private dataSource: DataSource,
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
    // 原子自增经验值，避免同一事件并发推进时互相覆盖
    return this.dataSource.transaction(async (manager) => {
      const before = await manager.findOne(User, {
        where: { id: userId },
        select: ["id", "experience", "level"],
      });
      if (!before) {
        throw new NotFoundException("response.error.userNotExist");
      }

      const oldLevel = before.level;

      await manager.increment(User, { id: userId }, "experience", amount);

      const user = await manager.findOne(User, {
        where: { id: userId },
        select: ["id", "experience", "level"],
      });
      if (!user) {
        throw new NotFoundException("response.error.userNotExist");
      }

      // 计算新等级
      const newLevel = this.calculateLevel(user.experience);
      const leveledUp = newLevel > oldLevel;

      if (newLevel !== user.level) {
        await manager.update(User, { id: userId }, { level: newLevel });
      }

      // 创建交易记录
      const transaction = manager.create(LevelTransaction, {
        userId,
        amount,
        balance: user.experience,
        level: newLevel,
        type: "EARN",
        source,
        description,
        relatedType,
        relatedId,
      });

      await manager.save(transaction);

      return {
        success: true,
        message: leveledUp
          ? "response.success.levelUp"
          : "response.success.experienceAdd",
        data: {
          amount,
          oldLevel,
          newLevel,
          leveledUp,
          experience: user.experience,
          nextLevelExp: this.getNextLevelExp(newLevel),
          currentLevelExp: this.getCurrentLevelExp(user.experience, newLevel),
          transaction,
        },
      };
    });
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
    const nextLevelConfig = this.LEVEL_CONFIG.find(
      (config) => config.level === currentLevel + 1,
    );
    if (!nextLevelConfig) {
      return 0; // 已达到最高等级
    }
    const currentLevelConfig = this.LEVEL_CONFIG.find(
      (config) => config.level === currentLevel,
    );
    return nextLevelConfig.totalExp - (currentLevelConfig?.totalExp || 0);
  }

  /**
   * 获取当前等级的经验进度
   */
  private getCurrentLevelExp(totalExp: number, currentLevel: number): number {
    const currentLevelConfig = this.LEVEL_CONFIG.find(
      (config) => config.level === currentLevel,
    );
    return totalExp - (currentLevelConfig?.totalExp || 0);
  }

}
