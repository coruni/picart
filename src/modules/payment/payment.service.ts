import { Injectable, BadRequestException, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { Order } from '../order/entities/order.entity';
import { User } from '../user/entities/user.entity';
import { ConfigService } from '../config/config.service';
import { OrderService } from '../order/order.service';
import { UserService } from '../user/user.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { AlipayNotifyDto, WechatNotifyDto } from './dto/payment-notify.dto';
import { CommissionService } from '../../common/services/commission.service';

@Injectable()
export class PaymentService implements OnModuleInit {
  constructor(
    @InjectRepository(Payment)
    private paymentRecordRepository: Repository<Payment>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private configService: ConfigService,
    private orderService: OrderService,
    private userService: UserService,
    private commissionService: CommissionService,
  ) {}

  async onModuleInit() {
    await this.initializePaymentSDKs();
  }

  private async initializePaymentSDKs() {
    try {
      const paymentConfig = await this.configService.getPaymentConfig();
      console.log('支付配置加载成功:', {
        alipayEnabled: paymentConfig.alipayEnabled,
        wechatEnabled: paymentConfig.wechatEnabled,
      });
    } catch (error) {
      console.error('支付配置加载失败:', error);
    }
  }

  /**
   * 创建支付记录
   */
  async createPayment(createPaymentDto: CreatePaymentDto, userId: number) {
    const { orderId, paymentMethod, details } = createPaymentDto;

    // 检查订单是否存在
    const order = await this.orderRepository.findOne({
      where: { id: orderId, userId },
    });

    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    if (order.status === 'PAID') {
      throw new BadRequestException('订单已支付');
    }

    // 检查支付方式是否启用
    const paymentConfig = await this.configService.getPaymentConfig();
    if (paymentMethod === 'ALIPAY' && !paymentConfig.alipayEnabled) {
      throw new BadRequestException('支付宝支付未启用');
    }
    if (paymentMethod === 'WECHAT' && !paymentConfig.wechatEnabled) {
      throw new BadRequestException('微信支付未启用');
    }

    // 创建支付记录 - 使用订单中的金额
    const paymentRecord = this.paymentRecordRepository.create({
      orderId,
      userId,
      paymentMethod,
      amount: order.amount, // 从订单中获取金额
      details: details ? JSON.parse(details) : null,
      status: 'PENDING',
    });

    const savedRecord = await this.paymentRecordRepository.save(paymentRecord);

    // 根据支付方式创建支付
    switch (paymentMethod) {
      case 'ALIPAY':
        return await this.createAlipayPayment(savedRecord, order);
      case 'WECHAT':
        return await this.createWechatPayment(savedRecord, order);
      case 'BALANCE':
        return await this.createBalancePayment(savedRecord, order, userId);
      default:
        throw new BadRequestException('不支持的支付方式');
    }
  }

  /**
   * 创建支付宝支付
   */
  private async createAlipayPayment(paymentRecord: Payment, order: Order) {
    const paymentConfig = await this.configService.getPaymentConfig();
    
    // 模拟支付宝支付URL生成
    const paymentUrl = `${paymentConfig.alipay.gateway}?out_trade_no=${order.orderNo}&total_amount=${order.amount}&subject=${order.title}`;

    // 更新支付记录
    paymentRecord.details = { alipayUrl: paymentUrl };
    await this.paymentRecordRepository.save(paymentRecord);

    return {
      paymentId: paymentRecord.id,
      paymentUrl: paymentUrl,
      paymentMethod: 'ALIPAY',
      message: '请跳转到支付宝完成支付',
    };
  }

  /**
   * 创建微信支付
   */
  private async createWechatPayment(paymentRecord: Payment, order: Order) {
    const paymentConfig = await this.configService.getPaymentConfig();
    
    // 模拟微信支付二维码URL生成
    const codeUrl = `weixin://wxpay/bizpayurl?pr=${order.orderNo}`;

    // 更新支付记录
    paymentRecord.details = { wechatCodeUrl: codeUrl };
    await this.paymentRecordRepository.save(paymentRecord);

    return {
      paymentId: paymentRecord.id,
      codeUrl: codeUrl,
      paymentMethod: 'WECHAT',
      message: '请使用微信扫码完成支付',
    };
  }

  /**
   * 创建余额支付
   */
  private async createBalancePayment(
    paymentRecord: Payment,
    order: Order,
    userId: number,
  ) {
    // 检查用户余额
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    if (user.wallet < order.amount) {
      throw new BadRequestException('余额不足');
    }

    // 扣除余额
    user.wallet -= order.amount;
    await this.userRepository.save(user);

    // 更新支付记录
    paymentRecord.status = 'SUCCESS';
    paymentRecord.paidAt = new Date();
    paymentRecord.details = { balancePayment: true };
    await this.paymentRecordRepository.save(paymentRecord);

    // 标记订单为已支付
    await this.orderService.markOrderAsPaid(order.id, 'BALANCE');

    // 处理佣金分配
    await this.commissionService.handleOrderPayment(
      order.id,
      order.amount,
      order.type,
      order.authorId,
      order.userId,
    );

    return {
      paymentId: paymentRecord.id,
      status: 'SUCCESS',
      paymentMethod: 'BALANCE',
      message: '余额支付成功',
    };
  }

  /**
   * 处理支付宝回调
   */
  async handleAlipayNotify(notifyData: AlipayNotifyDto) {
    // 查找订单
    const order = await this.orderRepository.findOne({
      where: { orderNo: notifyData.out_trade_no },
    });

    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    // 查找支付记录
    const paymentRecord = await this.paymentRecordRepository.findOne({
      where: { orderId: order.id },
    });

    if (!paymentRecord) {
      throw new NotFoundException('支付记录不存在');
    }

    // 检查交易状态
    if (notifyData.trade_status === 'TRADE_SUCCESS') {
      // 更新支付记录
      paymentRecord.status = 'SUCCESS';
      paymentRecord.thirdPartyOrderNo = notifyData.trade_no;
      paymentRecord.paidAt = new Date();
      paymentRecord.details = { ...paymentRecord.details, notifyData };
      await this.paymentRecordRepository.save(paymentRecord);

      // 标记订单为已支付
      await this.orderService.markOrderAsPaid(order.id, 'ALIPAY');

      // 处理佣金分配
      await this.commissionService.handleOrderPayment(
        order.id,
        order.amount,
        order.type,
        order.authorId,
        order.userId,
      );
    } else if (notifyData.trade_status === 'TRADE_CLOSED') {
      paymentRecord.status = 'FAILED';
      paymentRecord.errorMessage = '交易关闭';
      await this.paymentRecordRepository.save(paymentRecord);
    }

    return { success: true };
  }

  /**
   * 处理微信支付回调
   */
  async handleWechatNotify(notifyData: WechatNotifyDto) {
    // 查找订单
    const order = await this.orderRepository.findOne({
      where: { orderNo: notifyData.out_trade_no },
    });

    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    // 查找支付记录
    const paymentRecord = await this.paymentRecordRepository.findOne({
      where: { orderId: order.id },
    });

    if (!paymentRecord) {
      throw new NotFoundException('支付记录不存在');
    }

    // 检查交易状态
    if (notifyData.trade_state === 'SUCCESS') {
      // 更新支付记录
      paymentRecord.status = 'SUCCESS';
      paymentRecord.thirdPartyOrderNo = notifyData.transaction_id;
      paymentRecord.paidAt = new Date();
      paymentRecord.details = { ...paymentRecord.details, notifyData };
      await this.paymentRecordRepository.save(paymentRecord);

      // 标记订单为已支付
      await this.orderService.markOrderAsPaid(order.id, 'WECHAT');

      // 处理佣金分配
      await this.commissionService.handleOrderPayment(
        order.id,
        order.amount,
        order.type,
        order.authorId,
        order.userId,
      );
    } else {
      paymentRecord.status = 'FAILED';
      paymentRecord.errorMessage = `交易失败: ${notifyData.trade_state}`;
      await this.paymentRecordRepository.save(paymentRecord);
    }

    return { success: true };
  }

  /**
   * 查询支付记录
   */
  async findPaymentRecord(id: number) {
    const paymentRecord = await this.paymentRecordRepository.findOne({
      where: { id },
      relations: ['order', 'user'],
    });

    if (!paymentRecord) {
      throw new NotFoundException('支付记录不存在');
    }

    return paymentRecord;
  }

  /**
   * 查询订单的支付记录
   */
  async findPaymentByOrderId(orderId: number) {
    const paymentRecord = await this.paymentRecordRepository.findOne({
      where: { orderId },
      relations: ['order', 'user'],
    });

    return paymentRecord;
  }

  /**
   * 查询用户的支付记录
   */
  async findUserPayments(userId: number, page: number = 1, limit: number = 10) {
    const [payments, total] = await this.paymentRecordRepository.findAndCount({
      where: { userId },
      relations: ['order'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: payments,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 模拟支付成功（用于测试）
   */
  async simulatePaymentSuccess(paymentId: number) {
    const paymentRecord = await this.findPaymentRecord(paymentId);
    
    if (paymentRecord.status !== 'PENDING') {
      throw new BadRequestException('支付记录状态不正确');
    }

    // 更新支付记录
    paymentRecord.status = 'SUCCESS';
    paymentRecord.paidAt = new Date();
    paymentRecord.thirdPartyOrderNo = `SIM_${Date.now()}`;
    await this.paymentRecordRepository.save(paymentRecord);

    // 获取订单信息
    const order = await this.orderRepository.findOne({
      where: { id: paymentRecord.orderId },
    });

    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    // 标记订单为已支付
    await this.orderService.markOrderAsPaid(paymentRecord.orderId, paymentRecord.paymentMethod);

    // 处理佣金分配
    await this.commissionService.handleOrderPayment(
      order.id,
      order.amount,
      order.type,
      order.authorId,
      order.userId,
    );

    return {
      success: true,
      message: '支付成功',
      paymentRecord,
    };
  }
}
