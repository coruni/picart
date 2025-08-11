import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Order } from "./entities/order.entity";
import { CommissionService } from "../../common/services/commission.service";
import { UserService } from "../user/user.service";
import { ListUtil, PermissionUtil } from "src/common/utils";
import { CreateArticleOrderDto } from "./dto/create-article-order.dto";
import { CreateMembershipOrderDto } from "./dto/create-membership-order.dto";
import { Article } from "../article/entities/article.entity";
import { AdminQueryOrdersDto } from "./dto/admin-query-orders.dto";
import { User } from "../user/entities/user.entity";
import { ConfigService } from "../config/config.service";

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(Article)
    private articleRepository: Repository<Article>,
    private commissionService: CommissionService,
    private userService: UserService,
    private configService: ConfigService,
  ) {}

  /**
   * 检查用户是否已支付文章费用
   */
  async hasPaidForArticle(userId: number, articleId: number): Promise<boolean> {
    try {
      const order = await this.orderRepository.findOne({
        where: {
          userId,
          type: "ARTICLE",
          status: "PAID",
          details: { articleId },
        },
      });

      return !!order;
    } catch (error) {
      console.error("检查文章支付状态失败:", error);
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
    });

    if (!order) {
      throw new NotFoundException("response.error.orderNotFound");
    }

    return order;
  }

  /**
   * 根据订单号查找订单
   */
  async findByOrderNo(orderNo: string, user: User) {
    const order = await this.orderRepository.findOne({
      where: { orderNo },
    });

    const hasPermission = await PermissionUtil.hasPermission(
      user,
      "order:manage",
    );
    if (!order) {
      throw new NotFoundException("response.error.orderNotFound");
    }
    if (!hasPermission && order?.userId !== user.id) {
      throw new ForbiddenException("response.error.noPermission");
    }

    return order;
  }

  /**
   * 获取用户的订单列表
   */
  async getUserOrders(
    userId: number,
    page: number = 1,
    limit: number = 10,
    status?: string,
    type?: string,
  ) {
    const whereCondition: any = { userId };

    if (status) {
      whereCondition.status = status;
    }

    if (type) {
      whereCondition.type = type;
    }

    const [orders, total] = await this.orderRepository.findAndCount({
      where: whereCondition,
      order: { createdAt: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
    });

    return ListUtil.buildPaginatedList(orders, total, page, limit);
  }

  /**
   * 获取所有订单列表（管理员权限）
   */
  async getAllOrders(adminQueryOrdersDto: AdminQueryOrdersDto) {
    const whereCondition: any = {};

    if (adminQueryOrdersDto.status) {
      whereCondition.status = adminQueryOrdersDto.status;
    }

    if (adminQueryOrdersDto.type) {
      whereCondition.type = adminQueryOrdersDto.type;
    }

    if (adminQueryOrdersDto.userId) {
      whereCondition.userId = adminQueryOrdersDto.userId;
    }

    const [orders, total] = await this.orderRepository.findAndCount({
      where: whereCondition,
      order: { createdAt: "DESC" },
      skip: (adminQueryOrdersDto.page - 1) * adminQueryOrdersDto.limit,
      take: adminQueryOrdersDto.limit,
    });

    return ListUtil.buildPaginatedList(
      orders,
      total,
      adminQueryOrdersDto.page,
      adminQueryOrdersDto.limit,
    );
  }

  /**
   * 更新订单状态
   */
  async updateOrderStatus(
    id: number,
    status: string,
    paidAt?: Date,
  ): Promise<Order> {
    const order = await this.findOne(id);
    order.status = status;
    if (paidAt) {
      order.paidAt = paidAt;
    }
    return await this.orderRepository.save(order);
  }

  /**
   * 标记订单为已支付
   */
  async markOrderAsPaid(
    orderId: number,
    paymentMethod: string,
  ): Promise<Order> {
    const order = await this.findOne(orderId);
    if (!order) {
      throw new NotFoundException("response.error.orderNotFound");
    }

    if (order.status === "PAID") {
      throw new BadRequestException("response.error.orderAlreadyPaid");
    }

    // 更新订单状态
    order.status = "PAID";
    order.paymentMethod = paymentMethod;
    order.paidAt = new Date();

    return await this.orderRepository.save(order);
  }

  /**
   * 生成订单号
   */
  generateOrderNo(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");
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
      throw new Error("订单金额和类型不能为空");
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
  private getCommissionType(
    orderType: string,
  ): "article" | "membership" | "product" | "service" {
    switch (orderType) {
      case "ARTICLE":
        return "article";
      case "MEMBERSHIP":
        return "membership";
      case "PRODUCT":
        return "product";
      case "SERVICE":
        return "service";
      default:
        return "service";
    }
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

  /**
   * 创建支付订单
   */
  async createPaymentOrder(
    userId: number,
    authorId: number,
    type: string,
    title: string,
    amount: number,
    details?: any,
  ): Promise<Order> {
    const orderData = {
      userId,
      authorId,
      type,
      title,
      amount,
      details,
      status: "PENDING",
      paymentMethod: undefined,
    };

    return await this.createOrder(orderData);
  }

  /**
   * 创建文章订单
   */
  async createArticleOrder(
    userId: number,
    createArticleOrderDto: CreateArticleOrderDto,
  ): Promise<Order> {
    const { articleId, remark } = createArticleOrderDto;

    // 查找文章
    const article = await this.articleRepository.findOne({
      where: { id: articleId },
      relations: ["author"],
    });

    if (!article) {
      throw new NotFoundException("response.error.articleNotFound");
    }

    if (!article.requirePayment) {
      throw new BadRequestException("response.error.articleNotNeedPayment");
    }

    if (article.viewPrice <= 0) {
      throw new BadRequestException("response.error.articlePriceInvalid");
    }

    // 检查用户是否已经购买过这篇文章
    const existingOrder = await this.orderRepository.findOne({
      where: {
        userId,
        articleId,
        status: "PAID",
      },
    });

    if (existingOrder) {
      throw new BadRequestException("response.error.articleAlreadyPurchased");
    }

    // 创建订单
    const orderData = {
      userId,
      authorId: article.authorId,
      articleId,
      type: "ARTICLE",
      title: `购买文章：${article.title}`,
      amount: article.viewPrice,
      details: {
        articleId: article.id,
        articleTitle: article.title,
        remark,
      },
      status: "PENDING",
      paymentMethod: undefined,
      remark,
    };

    return await this.createOrder(orderData);
  }

  /**
   * 创建会员充值订单
   */
  async createMembershipOrder(
    userId: number,
    createMembershipOrderDto: CreateMembershipOrderDto,
  ): Promise<Order> {
    const { duration, remark } = createMembershipOrderDto;

    // 验证充值时长
    if (duration < 1 || duration > 120) {
      // 最多120个月（10年）
      throw new BadRequestException("response.error.invalidMembershipDuration");
    }

    // 获取用户信息
    const user = await this.userService.findOne(userId);
    if (!user) {
      throw new NotFoundException("response.error.userNotFound");
    }

    // 从配置中获取会员价格
    const membershipPrice =
      (await this.configService.findByKey("membership_price")) || "19.9";
    const membershipName =
      (await this.configService.findByKey("membership_name")) || "VIP会员";

    const basePrice = parseFloat(membershipPrice.toString());
    const totalAmount = basePrice * duration;

    // 创建订单
    const orderData = {
      userId,
      authorId: 1, // 平台作为卖家，authorId设为1
      type: "MEMBERSHIP",
      title: `充值${membershipName} ${duration}个月`,
      amount: totalAmount,
      details: {
        membershipLevel: 1, // 固定为1级会员
        membershipName,
        duration,
        basePrice,
        totalAmount,
        remark,
      },
      status: "PENDING",
      paymentMethod: undefined,
      remark,
    };

    return await this.createOrder(orderData);
  }

  /**
   * 获取待支付订单
   */
  async getPendingOrders(userId: number) {
    const orders = await this.orderRepository.find({
      where: { userId, status: "PENDING" },
      order: { createdAt: "DESC" },
    });

    return orders;
  }

  /**
   * 取消订单
   */
  async cancelOrder(orderId: number, userId: number): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId, userId },
    });

    if (!order) {
      throw new NotFoundException("response.error.orderNotFound");
    }

    if (order.status !== "PENDING") {
      throw new BadRequestException("response.error.orderNotPending");
    }

    order.status = "CANCELLED";
    return await this.orderRepository.save(order);
  }

  /**
   * 申请退款
   */
  async requestRefund(
    orderId: number,
    userId: number,
    reason: string,
  ): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId, userId, status: "PAID" },
    });

    if (!order) {
      throw new NotFoundException("response.error.orderNotFound");
    }

    // 这里可以添加退款逻辑
    // 暂时只是更新订单状态
    order.status = "REFUNDED";
    order.details = {
      ...order.details,
      refund: {
        reason,
        requestedAt: new Date(),
      },
    };

    return await this.orderRepository.save(order);
  }
}
