import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { WalletTransaction } from './entities/wallet-transaction.entity';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(WalletTransaction)
    private walletTransactionRepository: Repository<WalletTransaction>,
  ) {}

  /**
   * 扣除余额（带事务和记录）
   * @param userId 用户ID
   * @param amount 扣除金额（正数）
   * @param type 交易类型
   * @param description 交易描述
   * @param orderId 关联订单ID（可选）
   * @param paymentId 关联支付记录ID（可选）
   * @param remark 备注（可选）
   */
  async deductBalance(
    userId: number,
    amount: number,
    type: 'PAYMENT' | 'WITHDRAW' | 'ADJUSTMENT',
    description: string,
    orderId?: number,
    paymentId?: number,
    remark?: string,
  ): Promise<{ success: boolean; balance: number; transaction: WalletTransaction }> {
    if (amount <= 0) {
      throw new BadRequestException('response.error.amountMustBePositive');
    }

    const queryRunner = this.userRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 使用悲观锁查询用户，防止并发问题
      const user = await queryRunner.manager.findOne(User, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!user) {
        throw new NotFoundException('response.error.userNotExist');
      }

      // 检查余额是否充足
      if (user.wallet < amount) {
        throw new BadRequestException('response.error.insufficientBalance');
      }

      const balanceBefore = user.wallet;
      const balanceAfter = user.wallet - amount;

      // 二次检查：确保余额不会为负
      if (balanceAfter < 0) {
        throw new BadRequestException('response.error.insufficientBalance');
      }

      // 扣除余额
      user.wallet = balanceAfter;
      await queryRunner.manager.save(user);

      // 创建交易记录（金额为负数表示支出）
      const transaction = queryRunner.manager.create(WalletTransaction, {
        userId,
        type,
        amount: -amount,
        balanceBefore,
        balanceAfter,
        orderId,
        paymentId,
        description,
        remark,
      });
      await queryRunner.manager.save(transaction);

      // 提交事务
      await queryRunner.commitTransaction();

      return {
        success: true,
        balance: balanceAfter,
        transaction,
      };
    } catch (error) {
      // 回滚事务
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      // 释放查询运行器
      await queryRunner.release();
    }
  }

  /**
   * 增加余额（带事务和记录）
   * @param userId 用户ID
   * @param amount 增加金额（正数）
   * @param type 交易类型
   * @param description 交易描述
   * @param orderId 关联订单ID（可选）
   * @param paymentId 关联支付记录ID（可选）
   * @param remark 备注（可选）
   */
  async addBalance(
    userId: number,
    amount: number,
    type: 'REFUND' | 'RECHARGE' | 'COMMISSION' | 'ADJUSTMENT',
    description: string,
    orderId?: number,
    paymentId?: number,
    remark?: string,
  ): Promise<{ success: boolean; balance: number; transaction: WalletTransaction }> {
    if (amount <= 0) {
      throw new BadRequestException('response.error.amountMustBePositive');
    }

    const queryRunner = this.userRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 使用悲观锁查询用户，防止并发问题
      const user = await queryRunner.manager.findOne(User, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!user) {
        throw new NotFoundException('response.error.userNotExist');
      }

      const balanceBefore = user.wallet;
      const balanceAfter = user.wallet + amount;

      // 增加余额
      user.wallet = balanceAfter;
      await queryRunner.manager.save(user);

      // 创建交易记录（金额为正数表示收入）
      const transaction = queryRunner.manager.create(WalletTransaction, {
        userId,
        type,
        amount,
        balanceBefore,
        balanceAfter,
        orderId,
        paymentId,
        description,
        remark,
      });
      await queryRunner.manager.save(transaction);

      // 提交事务
      await queryRunner.commitTransaction();

      return {
        success: true,
        balance: balanceAfter,
        transaction,
      };
    } catch (error) {
      // 回滚事务
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      // 释放查询运行器
      await queryRunner.release();
    }
  }

  /**
   * 获取用户余额
   */
  async getBalance(userId: number): Promise<number> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['wallet'],
    });

    if (!user) {
      throw new NotFoundException('response.error.userNotExist');
    }

    return user.wallet;
  }

  /**
   * 获取用户交易记录
   */
  async getTransactions(
    userId: number,
    page: number = 1,
    limit: number = 10,
    type?: string,
  ) {
    const whereCondition: any = { userId };

    if (type) {
      whereCondition.type = type;
    }

    const [transactions, total] = await this.walletTransactionRepository.findAndCount({
      where: whereCondition,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: transactions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 获取用户余额统计
   */
  async getBalanceStatistics(userId: number) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['wallet'],
    });

    if (!user) {
      throw new NotFoundException('response.error.userNotExist');
    }

    // 统计各类交易金额
    const transactions = await this.walletTransactionRepository
      .createQueryBuilder('transaction')
      .select('transaction.type', 'type')
      .addSelect('SUM(transaction.amount)', 'totalAmount')
      .addSelect('COUNT(*)', 'count')
      .where('transaction.userId = :userId', { userId })
      .groupBy('transaction.type')
      .getRawMany();

    return {
      currentBalance: user.wallet,
      transactions,
    };
  }
}
