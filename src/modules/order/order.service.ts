import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from './entities/order.entity';
import { User } from '../user/entities/user.entity';
import { CommissionService } from '../../common/services/commission.service';
import { UserService } from '../user/user.service';
import { ListUtil } from 'src/common/utils';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    private commissionService: CommissionService,
    private userService: UserService,
  ) {}

  /**
   * 检查用户是否已支付文章费用
   */
  async hasPaidForArticle(userId: number, articleId: number): Promise<boolean> {
    try {
      const order = await this.orderRepository.findOne({
        where: {
          userId,
          type: 'ARTICLE',
          status: 'PAID',
          details: { articleId },
        },
      });

      return !!order;
    } catch (error) {
      console.error('检查文章支付状态失败:', error);
      return false;
    }
  }

  /**
   * 创建订单
   */
  async createOrder(orderData: Partial<Order>): Promise<Order> {
    const order = this.orderRepository.create(orderData);
    return await this.orderRepository.save(order);
  }

  /**
   * 根据ID查找订单
   */
  async findOne(id: number): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    return order;
  }

  /**
   * 根据订单号查找订单
   */
  async findByOrderNo(orderNo: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { orderNo },
      relations: ['user'],
    });

    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    return order;
  }

  /**
   * 获取用户的订单列表
   */
  async getUserOrders(userId: number, page: number = 1, limit: number = 10) {
    const [orders, total] = await this.orderRepository.findAndCount({
      where: { userId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return ListUtil.buildPaginatedList(orders, total, page, limit);
  }

  /**
   * 更新订单状态
   */
  async updateOrderStatus(id: number, status: string, paidAt?: Date): Promise<Order> {
    const order = await this.findOne(id);
    order.status = status;
    if (paidAt) {
      order.paidAt = paidAt;
    }
    return await this.orderRepository.save(order);
  }

  /**
   * 生成订单号
   */
  generateOrderNo(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0');
    return `ORDER${timestamp}${random}`;
  }

  /**
   * 创建订单并计算抽成
   */
  async createOrderWithCommission(
    orderData: Partial<Order>,
    authorId: number,
  ): Promise<{ order: Order; commission: any }> {
    if (!orderData.amount || !orderData.type) {
      throw new Error('订单金额和类型不能为空');
    }

    // 计算抽成
    const commission = await this.commissionService.calculateCommission(
      authorId,
      orderData.amount,
      this.getCommissionType(orderData.type),
    );

    // 创建订单
    const order = this.orderRepository.create({
      ...orderData,
      orderNo: this.generateOrderNo(),
      details: {
        ...orderData.details,
        commission: {
          amount: commission.commissionAmount,
          rate: commission.commissionRate,
          configType: commission.configType,
        },
      },
    });

    const savedOrder = await this.orderRepository.save(order);

    return {
      order: savedOrder,
      commission,
    };
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
   * 处理订单支付完成
   */
  async handlePaymentComplete(orderId: number, paymentMethod: string = 'wallet') {
    const order = await this.findOne(orderId);
    if (!order) {
      throw new Error('订单不存在');
    }

    if (order.status === 'PAID') {
      throw new Error('订单已支付');
    }

    // 更新订单状态
    order.status = 'PAID';
    order.paymentMethod = paymentMethod;
    order.paidAt = new Date();
    await this.orderRepository.save(order);

    // 处理抽成和钱包更新（包括邀请分成）
    const result = await this.commissionService.handleOrderPayment(
      orderId,
      order.amount,
      order.type,
      order.authorId,
      order.userId,
    );

    return {
      order,
      commission: result.commission,
      authorWallet: result.authorWallet,
      buyerWallet: result.buyerWallet,
      inviteCommission: result.inviteCommission,
    };
  }

  /**
   * 检查用户钱包余额
   */
  async checkWalletBalance(userId: number, amount: number): Promise<boolean> {
    const user = await this.userService.findOne(userId);
    if (!user) {
      return false;
    }
    return user.wallet >= amount;
  }
}
