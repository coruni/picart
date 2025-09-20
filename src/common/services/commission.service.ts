import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Config } from '../../modules/config/entities/config.entity';
import { UserConfig } from '../../modules/user/entities/user-config.entity';
import { User } from '../../modules/user/entities/user.entity';
import { Invite } from '../../modules/invite/entities/invite.entity';
import { InviteCommission } from '../../modules/invite/entities/invite-commission.entity';
import { Order } from '../../modules/order/entities/order.entity';

@Injectable()
export class CommissionService {
  constructor(
    @InjectRepository(Config)
    private configRepository: Repository<Config>,
    @InjectRepository(UserConfig)
    private userConfigRepository: Repository<UserConfig>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Invite)
    private inviteRepository: Repository<Invite>,
    @InjectRepository(InviteCommission)
    private inviteCommissionRepository: Repository<InviteCommission>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
  ) { }

  /**
   * 获取全局抽成配置
   */
  async getGlobalCommissionConfig() {
    const configs = await this.configRepository.find({
      where: { group: 'commission' },
    });

    const commissionConfig = {
      articleCommissionRate: 0.1, // 默认10%
      membershipCommissionRate: 0.1,
      productCommissionRate: 0.1,
      serviceCommissionRate: 0.1,
    };

    configs.forEach((config) => {
      const value = parseFloat(config.value);
      if (!isNaN(value)) {
        switch (config.key) {
          case 'article_commission_rate':
            commissionConfig.articleCommissionRate = value;
            break;
          case 'membership_commission_rate':
            commissionConfig.membershipCommissionRate = value;
            break;
          case 'product_commission_rate':
            commissionConfig.productCommissionRate = value;
            break;
          case 'service_commission_rate':
            commissionConfig.serviceCommissionRate = value;
            break;
        }
      }
    });

    return commissionConfig;
  }

  /**
   * 获取用户抽成配置
   */
  async getUserCommissionConfig(userId: number) {
    // 通过用户关系获取配置
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['config'],
    });

    if (!user) {
      throw new Error('用户不存在');
    }

    if (!user.config) {
      // 如果用户没有配置，创建默认配置
      const userConfig = this.userConfigRepository.create({
        userId,
        articleCommissionRate: 0.1,
        membershipCommissionRate: 0.1,
        productCommissionRate: 0.1,
        serviceCommissionRate: 0.1,
        enableCustomCommission: false,
      });
      user.config = await this.userConfigRepository.save(userConfig);
    }

    return user.config;
  }

  /**
   * 计算抽成金额
   */
  async calculateCommission(
    userId: number,
    amount: number,
    type: 'article' | 'membership' | 'product' | 'service',
  ) {
    // 通过用户关系获取配置
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['config'],
    });

    if (!user) {
      throw new Error('用户不存在');
    }

    // 如果用户启用了自定义抽成，使用用户配置
    if (user.config && user.config.enableCustomCommission) {
      let rate = 0.1; // 默认10%

      switch (type) {
        case 'article':
          rate = user.config.articleCommissionRate;
          break;
        case 'membership':
          rate = user.config.membershipCommissionRate;
          break;
        case 'product':
          rate = user.config.productCommissionRate;
          break;
        case 'service':
          rate = user.config.serviceCommissionRate;
          break;
      }

      return {
        commissionAmount: amount * rate,
        commissionRate: rate,
        userAmount: amount * (1 - rate),
        configType: 'user',
      };
    } else {
      // 使用全局配置
      const globalConfig = await this.getGlobalCommissionConfig();
      let rate = 0.1; // 默认10%

      switch (type) {
        case 'article':
          rate = globalConfig.articleCommissionRate;
          break;
        case 'membership':
          rate = globalConfig.membershipCommissionRate;
          break;
        case 'product':
          rate = globalConfig.productCommissionRate;
          break;
        case 'service':
          rate = globalConfig.serviceCommissionRate;
          break;
      }

      return {
        commissionAmount: amount * rate,
        commissionRate: rate,
        userAmount: amount * (1 - rate),
        configType: 'global',
      };
    }
  }

  /**
   * 设置全局抽成配置
   */
  async setGlobalCommissionConfig(config: {
    articleCommissionRate?: number;
    membershipCommissionRate?: number;
    productCommissionRate?: number;
    serviceCommissionRate?: number;
  }) {
    const configs = [
      {
        key: 'article_commission_rate',
        value: config.articleCommissionRate?.toString(),
      },
      {
        key: 'membership_commission_rate',
        value: config.membershipCommissionRate?.toString(),
      },
      {
        key: 'product_commission_rate',
        value: config.productCommissionRate?.toString(),
      },
      {
        key: 'service_commission_rate',
        value: config.serviceCommissionRate?.toString(),
      },
    ];

    for (const item of configs) {
      if (item.value) {
        await this.configRepository.save({
          key: item.key,
          value: item.value,
          group: 'commission',
          type: 'number',
          description: `${item.key} 全局抽成配置`,
        });
      }
    }
  }

  /**
   * 设置用户抽成配置
   */
  async setUserCommissionConfig(userId: number, config: Partial<UserConfig>) {
    // 通过用户关系获取配置
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['config'],
    });

    if (!user) {
      throw new Error('用户不存在');
    }

    if (!user.config) {
      // 如果用户没有配置，创建新配置
      user.config = this.userConfigRepository.create({
        userId,
        ...config,
      });
    } else {
      // 更新现有配置
      Object.assign(user.config, config);
    }

    await this.userConfigRepository.save(user.config);
    return {
      message: 'response.success.userConfigSaved',
      data: user.config,
    }
  }

  /**
   * 处理订单支付完成后的抽成和钱包更新
   */
  async handleOrderPayment(
    orderId: number,
    orderAmount: number,
    orderType: string,
    authorId: number,
    buyerId: number,
  ) {
    // 获取分成配置
    const commissionConfig = await this.getCommissionConfig();

    // 计算分成
    const platformAmount = orderAmount * commissionConfig.platformRate; // 平台分成
    const authorAmount = orderAmount * commissionConfig.authorRate; // 作者分成
    const inviterAmount = orderAmount * commissionConfig.inviterRate; // 邀请者分成

    // 更新作者钱包（增加收入）
    const author = await this.userRepository.findOne({
      where: { id: authorId },
    });

    if (author) {
      author.wallet += authorAmount;
      await this.userRepository.save(author);
    }

    // 处理邀请分成
    let inviteCommission: any = null;
    try {
      const result = await this.handleInviteCommission(
        orderId,
        orderType,
        orderAmount,
        authorId,
        buyerId,
        inviterAmount,
      );
      inviteCommission = result;
    } catch (error) {
      console.error('处理邀请分成失败:', error);
    }

    // 特殊处理：会员充值订单
    if (orderType === 'MEMBERSHIP') {
      await this.handleMembershipPayment(orderId, buyerId);
    }

    return {
      commission: {
        platformAmount,
        authorAmount,
        inviterAmount,
        platformRate: commissionConfig.platformRate,
        authorRate: commissionConfig.authorRate,
        inviterRate: commissionConfig.inviterRate,
      },
      authorWallet: author?.wallet || 0,
      inviteCommission,
    };
  }

  /**
   * 处理会员充值支付完成
   */
  private async handleMembershipPayment(orderId: number, userId: number) {
    // 获取订单详情
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });

    if (!order || order.type !== 'MEMBERSHIP') {
      throw new Error('订单类型错误');
    }

    const { membershipLevel, membershipName, duration, isLifetime } = order.details;

    // 获取用户信息
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('用户不存在');
    }

    // 计算会员到期时间
    const now = new Date();
    let newEndDate: Date | null = null;

    if (isLifetime) {
      // 永久会员：到期时间必须置空
      newEndDate = null;
    } else {
      let addMonths = typeof duration === 'number' ? duration : 0;
      if (user.membershipStatus === 'ACTIVE' && user.membershipEndDate && user.membershipEndDate > now) {
        // 如果用户已经是活跃会员且未过期，在现有到期时间基础上延长
        newEndDate = new Date(user.membershipEndDate);
        newEndDate.setMonth(newEndDate.getMonth() + addMonths);
      } else {
        // 如果用户不是活跃会员或已过期，从当前时间开始计算
        newEndDate = new Date(now);
        newEndDate.setMonth(newEndDate.getMonth() + addMonths);
      }
    }

    // 更新用户会员信息
    user.membershipLevel = Math.max(user.membershipLevel, membershipLevel); // 取最高等级
    user.membershipLevelName = membershipName;
    user.membershipStatus = 'ACTIVE';
    user.membershipStartDate = user.membershipStartDate || now;
    user.membershipEndDate = newEndDate;

    await this.userRepository.save(user);

    console.log(`用户 ${userId} 会员充值成功: ${membershipName} ${duration}个月，到期时间: ${newEndDate}`);
  }

  /**
   * 处理邀请分成
   */
  async handleInviteCommission(
    orderId: number,
    orderType: string,
    orderAmount: number,
    authorId: number,
    buyerId: number,
    inviterAmount: number,
  ) {
    // 检查买家是否是通过邀请注册的
    const buyer = await this.userRepository.findOne({
      where: { id: buyerId },
    });

    if (!buyer || !buyer.inviterId) {
      return null;
    }

    // 获取邀请记录
    const invite = await this.inviteRepository.findOne({
      where: {
        inviterId: buyer.inviterId,
        inviteeId: buyerId,
        status: 'USED',
      },
    });

    if (!invite) {
      return null;
    }

    // 创建分成记录
    const inviteCommission = this.inviteCommissionRepository.create({
      inviteId: invite.id,
      inviterId: invite.inviterId,
      inviteeId: buyerId,
      orderId,
      orderType,
      orderAmount,
      commissionRate: invite.commissionRate,
      commissionAmount: inviterAmount,
      status: 'PENDING',
    });

    const savedCommission = await this.inviteCommissionRepository.save(inviteCommission);

    // 更新邀请人钱包
    const inviter = await this.userRepository.findOne({
      where: { id: invite.inviterId },
    });
    if (inviter) {
      inviter.wallet += inviterAmount;
      inviter.inviteEarnings += inviterAmount;
      await this.userRepository.save(inviter);
    }

    // 更新分成记录状态
    savedCommission.status = 'PAID';
    savedCommission.paidAt = new Date();
    await this.inviteCommissionRepository.save(savedCommission);

    return savedCommission;
  }

  /**
   * 获取抽成类型
   */
  private getCommissionType(orderType: string): 'article' | 'membership' | 'product' | 'service' {
    switch (orderType) {
      case 'ARTICLE':
        return 'article';
      case 'MEMBERSHIP':
        return 'membership';
      case 'PRODUCT':
        return 'product';
      case 'SERVICE':
        return 'service';
      default:
        return 'service';
    }
  }

  /**
   * 获取分成配置
   */
  private async getCommissionConfig() {
    const configs = await this.configRepository.find({
      where: { group: 'commission' },
    });

    const commissionConfig = {
      inviterRate: 0.05,
      platformRate: 0.1,
      authorRate: 0.85,
    };

    configs.forEach((config) => {
      const value = this.parseConfigValue(config);
      switch (config.key) {
        case 'commission_inviter_rate':
          commissionConfig.inviterRate = value as number;
          break;
        case 'commission_platform_rate':
          commissionConfig.platformRate = value as number;
          break;
        case 'commission_author_rate':
          commissionConfig.authorRate = value as number;
          break;
      }
    });

    return commissionConfig;
  }

  /**
   * 解析配置值
   */
  private parseConfigValue(config: Config): unknown {
    switch (config.type) {
      case 'boolean':
        return config.value === 'true';
      case 'number':
        return parseFloat(config.value);
      case 'json':
        return JSON.parse(config.value);
      default:
        return config.value;
    }
  }
}
