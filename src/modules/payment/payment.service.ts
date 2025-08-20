import {
  Injectable,
  BadRequestException,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Payment } from "./entities/payment.entity";
import { Order } from "../order/entities/order.entity";
import { User } from "../user/entities/user.entity";
import { ConfigService } from "../config/config.service";
import { OrderService } from "../order/order.service";
import { UserService } from "../user/user.service";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import {
  AlipayNotifyDto,
  WechatNotifyDto,
  EpayNotifyDto,
} from "./dto/payment-notify.dto";
import { CommissionService } from "../../common/services/commission.service";
import { AlipaySdk } from "alipay-sdk";
import WxPay from "wechatpay-node-v3";

import { OnEvent } from "@nestjs/event-emitter";
import * as crypto from "crypto";

@Injectable()
export class PaymentService implements OnModuleInit {
  private alipaySdk: AlipaySdk | null = null;
  private wechatPay: WxPay | null = null; // 微信支付SDK实例
  private epayConfig: any = null; // 易支付配置
  private lastConfigHash: string = "";

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

  /**
   * 监听配置更新事件
   */
  @OnEvent("config.updated")
  async handleConfigUpdated() {
    await this.reinitializePaymentSDKs();
  }

  /**
   * 初始化支付SDK
   */
  private async initializePaymentSDKs() {
    try {
      const paymentConfig = await this.configService.getPaymentConfig();
      const configHash = this.generateConfigHash(paymentConfig);

      // 如果配置没有变化，不需要重新初始化
      if (configHash === this.lastConfigHash) {
        console.log("支付配置未变化，跳过SDK初始化");
        return;
      }

      console.log("开始初始化支付SDK...");

      // 初始化支付宝SDK
      if (
        paymentConfig.alipayEnabled &&
        paymentConfig.alipay.appId &&
        paymentConfig.alipay.privateKey
      ) {
        this.alipaySdk = new AlipaySdk({
          appId: paymentConfig.alipay.appId,
          privateKey: paymentConfig.alipay.privateKey,
          alipayPublicKey: paymentConfig.alipay.publicKey,
          gateway: paymentConfig.alipay.gateway,
        });
        console.log("支付宝SDK初始化成功");
      } else {
        this.alipaySdk = null;
        console.log("支付宝配置不完整，跳过SDK初始化");
      }

      // 初始化微信支付SDK
      if (
        paymentConfig.wechatEnabled &&
        paymentConfig.wechat.appId &&
        paymentConfig.wechat.mchId &&
        paymentConfig.wechat.privateKey &&
        paymentConfig.wechat.publicKey
      ) {
        this.wechatPay = new WxPay({
          appid: paymentConfig.wechat.appId,
          mchid: paymentConfig.wechat.mchId,
          privateKey: Buffer.from(paymentConfig.wechat.privateKey),
          publicKey: Buffer.from(paymentConfig.wechat.publicKey),
          serial_no: paymentConfig.wechat.serialNo,
          key: paymentConfig.wechat.apiKey,
        });
        console.log("微信支付SDK初始化成功");
      } else {
        this.wechatPay = null;
        console.log("微信支付配置不完整，跳过SDK初始化");
      }

      // 初始化易支付配置
      if (
        paymentConfig.epayEnabled &&
        paymentConfig.epay.appId &&
        paymentConfig.epay.appKey &&
        paymentConfig.epay.gateway
      ) {
        this.epayConfig = {
          appId: paymentConfig.epay.appId,
          appKey: paymentConfig.epay.appKey,
          gateway: paymentConfig.epay.gateway,
          notifyUrl: paymentConfig.epay.notifyUrl,
          returnUrl: paymentConfig.returnUrl,
        };
        console.log("易支付配置初始化成功", this.epayConfig);
      } else {
        this.epayConfig = null;
        console.log("易支付配置不完整，跳过初始化");
      }

      this.lastConfigHash = configHash;
      console.log("支付SDK初始化完成");
    } catch (error) {
      console.error("支付SDK初始化失败:", error);
    }
  }

  /**
   * 重新初始化支付SDK（当配置更新时调用）
   */
  async reinitializePaymentSDKs() {
    await this.initializePaymentSDKs();
  }

  /**
   * 生成配置哈希值，用于检测配置变化
   */
  private generateConfigHash(config: any): string {
    const configString = JSON.stringify({
      alipayEnabled: config.alipayEnabled,
      wechatEnabled: config.wechatEnabled,
      epayEnabled: config.epayEnabled,
      alipay: {
        appId: config.alipay.appId,
        gateway: config.alipay.gateway,
      },
      wechat: {
        appId: config.wechat.appId,
        mchId: config.wechat.mchId,
        privateKey: config.wechat.privateKey,
        publicKey: config.wechat.publicKey,
        serialNo: config.wechat.serialNo,
      },
      epay: {
        appId: config.epay.appId,
        appKey: config.epay.appKey,
        gateway: config.epay.gateway,
      },
    });
    return Buffer.from(configString).toString("base64");
  }

  /**
   * 易支付签名参数处理函数
   */
  private getVerifyParams(params: any): string {
    let sPara: [string, string][] = [];
    if (!params) return "";

    for (var key in params) {
      if (!params[key] || key == "sign" || key == "sign_type") {
        continue;
      }
      sPara.push([key, params[key]]);
    }

    sPara = sPara.sort();
    var prestr = "";

    for (var i2 = 0; i2 < sPara.length; i2++) {
      var obj = sPara[i2];
      if (i2 == sPara.length - 1) {
        prestr = prestr + obj[0] + "=" + obj[1] + "";
      } else {
        prestr = prestr + obj[0] + "=" + obj[1] + "&";
      }
    }

    return prestr;
  }

  /**
   * 获取当前支付宝SDK实例
   */
  private getAlipaySdk(): AlipaySdk {
    if (!this.alipaySdk) {
      throw new BadRequestException("response.error.alipaySdkNotInitialized");
    }
    return this.alipaySdk;
  }

  /**
   * 获取当前微信支付SDK实例
   */
  private getWechatPay(): WxPay {
    if (!this.wechatPay) {
      throw new BadRequestException(
        "response.error.wechatPaySdkNotInitialized",
      );
    }
    return this.wechatPay;
  }

  /**
   * 获取当前易支付配置
   */
  private getEpayConfig(): any {
    if (!this.epayConfig) {
      throw new BadRequestException("response.error.epayConfigNotInitialized");
    }
    return this.epayConfig;
  }

  /**
   * 创建支付记录
   */
  async createPayment(createPaymentDto: CreatePaymentDto, userId: number) {
    const { orderId, paymentMethod, returnUrl, type } = createPaymentDto;

    // 检查订单是否存在
    const order = await this.orderRepository.findOne({
      where: { id: orderId, userId },
    });

    if (!order) {
      throw new NotFoundException("response.error.orderNotFound");
    }

    if (order.status === "PAID") {
      throw new BadRequestException("response.error.orderAlreadyPaid");
    }

    // 检查支付方式是否启用
    const paymentConfig = await this.configService.getPaymentConfig();
    if (paymentMethod === "ALIPAY" && !paymentConfig.alipayEnabled) {
      throw new BadRequestException("response.error.alipayNotEnabled");
    }
    if (paymentMethod === "WECHAT" && !paymentConfig.wechatEnabled) {
      throw new BadRequestException("response.error.wechatPayNotEnabled");
    }
    if (paymentMethod === "EPAY" && !paymentConfig.epayEnabled) {
      throw new BadRequestException("response.error.epayNotEnabled");
    }

    // 创建支付记录 - 使用订单中的金额
    const paymentRecord = this.paymentRecordRepository.create({
      orderId,
      userId,
      paymentMethod,
      amount: order.amount, // 从订单中获取金额
      details: order.details,
      status: "PENDING",
    });

    const savedRecord = await this.paymentRecordRepository.save(paymentRecord);

    // 根据支付方式创建支付
    switch (paymentMethod) {
      case "ALIPAY":
        return await this.createAlipayPayment(savedRecord, order, returnUrl);
      case "WECHAT":
        return await this.createWechatPayment(savedRecord, order);
      case "EPAY":
        return await this.createEpayPayment(
          savedRecord,
          order,
          returnUrl,
          type,
        );
      case "BALANCE":
        return await this.createBalancePayment(savedRecord, order, userId);
      default:
        throw new BadRequestException(
          "response.error.unsupportedPaymentMethod",
        );
    }
  }

  /**
   * 创建支付宝支付
   */
  private async createAlipayPayment(
    paymentRecord: Payment,
    order: Order,
    returnUrl?: string,
  ) {
    try {
      const alipaySdk = this.getAlipaySdk();
      const paymentConfig = await this.configService.getPaymentConfig();

      // 使用支付宝SDK创建支付订单
      const result = await alipaySdk.exec("alipay.trade.page.pay", {
        notify_url: paymentConfig.notifyUrl,
        return_url: returnUrl || paymentConfig.returnUrl, // 优先使用前端传入的returnUrl
        bizContent: {
          out_trade_no: order.orderNo,
          total_amount: order.amount,
          subject: order.title,
          product_code: "FAST_INSTANT_TRADE_PAY",
        },
      });

      // 更新支付记录
      paymentRecord.details = {
        alipayUrl: result,
        orderNo: order.orderNo,
        amount: order.amount,
      };
      await this.paymentRecordRepository.save(paymentRecord);

      return {
        data: {
          paymentId: paymentRecord.id,
          paymentUrl: result,
          paymentMethod: "ALIPAY",
        },
        success: true,
        message: "response.success.createAlipayPayment",
      };
    } catch (error) {
      console.error("创建支付宝支付失败:", error);
      throw new BadRequestException("response.error.createAlipayPaymentFailed");
    }
  }

  /**
   * 创建微信支付
   */
  private async createWechatPayment(paymentRecord: Payment, order: Order) {
    try {
      const wechatPay = this.getWechatPay();
      const paymentConfig = await this.configService.getPaymentConfig();

      // 使用微信支付SDK创建支付订单
      const result = (await wechatPay.transactions_native({
        description: order.title,
        out_trade_no: order.orderNo,
        amount: {
          total: Math.round(order.amount * 100), // 转换为分
        },
        notify_url: paymentConfig.notifyUrl + "/wechat",
      })) as any;

      // 更新支付记录
      paymentRecord.details = {
        wechatCodeUrl: result.code_url,
        orderNo: order.orderNo,
        amount: order.amount,
        appId: paymentConfig.wechat.appId,
        mchId: paymentConfig.wechat.mchId,
        prepayId: result.prepay_id,
      };
      await this.paymentRecordRepository.save(paymentRecord);

      return {
        data: {
          paymentId: paymentRecord.id,
          codeUrl: result.code_url,
          paymentMethod: "WECHAT",
        },
        success: true,
        message: "response.success.createWechatPayment",
      };
    } catch (error) {
      console.error("创建微信支付失败:", error);
      throw new BadRequestException("response.error.createWechatPaymentFailed");
    }
  }

  /**
   * 创建易支付
   */
  private async createEpayPayment(
    paymentRecord: Payment,
    order: Order,
    returnUrl?: string,
    type?: string,
  ) {
    try {
      const epayConfig = this.getEpayConfig();

      // 生成易支付参数
      const params: any = {
        pid: epayConfig.appId,
        type: type || "alipay", // 支付类型：alipay, wxpay, qqpay等，优先使用传入的type
        out_trade_no: order.orderNo,
        notify_url: epayConfig.notifyUrl,
        return_url: returnUrl || epayConfig.returnUrl, // 优先使用前端传入的returnUrl
        name: order.title,
        money: order.amount, // 使用订单实际金额
        sign_type: "MD5",
      };

      // 使用参考代码的签名计算方法
      const signStr = this.getVerifyParams(params);
      const sign = crypto
        .createHash("md5")
        .update(signStr + epayConfig.appKey)
        .digest("hex");
      params.sign = sign;

      // 构建支付URL
      const queryString = Object.keys(params)
        .map((key) => `${key}=${encodeURIComponent(params[key])}`)
        .join("&");
      const paymentUrl = `${epayConfig.gateway}/submit.php?${queryString}`;

      // 更新支付记录
      paymentRecord.details = {
        epayUrl: paymentUrl,
        orderNo: order.orderNo,
        amount: order.amount,
        appId: epayConfig.appId,
        params: params,
      };
      await this.paymentRecordRepository.save(paymentRecord);

      return {
        data: {
          paymentId: paymentRecord.id,
          paymentUrl: paymentUrl,
          paymentMethod: "EPAY",
        },
        success: true,
        message: "response.success.createEpayPayment",
      };
    } catch (error) {
      console.error("创建易支付失败:", error);
      throw new BadRequestException("response.error.createEpayPaymentFailed");
    }
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
      throw new NotFoundException("response.error.userNotFound");
    }

    if (user.wallet < order.amount) {
      throw new BadRequestException("response.error.balanceNotEnough");
    }

    // 扣除余额
    user.wallet -= order.amount;
    await this.userRepository.save(user);

    // 更新支付记录
    paymentRecord.status = "SUCCESS";
    paymentRecord.paidAt = new Date();
    paymentRecord.details = { balancePayment: true };
    await this.paymentRecordRepository.save(paymentRecord);

    // 标记订单为已支付
    await this.orderService.markOrderAsPaid(order.id, "BALANCE");

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
      status: "SUCCESS",
      paymentMethod: "BALANCE",
      message: "余额支付成功",
    };
  }

  /**
   * 处理支付宝回调
   */
  async handleAlipayNotify(notifyData: AlipayNotifyDto) {
    try {
      // 使用支付宝SDK验证回调签名
      const alipaySdk = this.getAlipaySdk();
      const isValid = await alipaySdk.checkNotifySign(notifyData);

      if (!isValid) {
        console.error("支付宝回调签名验证失败");
        return { success: false, message: "签名验证失败" };
      }

      // 查找订单
      const order = await this.orderRepository.findOne({
        where: { orderNo: notifyData.out_trade_no },
      });

      if (!order) {
        console.error("订单不存在:", notifyData.out_trade_no);
        return { success: false, message: "订单不存在" };
      }

      // 查找支付记录
      const paymentRecord = await this.paymentRecordRepository.findOne({
        where: { orderId: order.id },
      });

      if (!paymentRecord) {
        console.error("支付记录不存在，订单ID:", order.id);
        return { success: false, message: "支付记录不存在" };
      }

      // 防止重复处理：检查支付记录是否已经成功
      if (paymentRecord.status === "SUCCESS") {
        console.log(
          "支付已成功，跳过重复处理，订单号:",
          notifyData.out_trade_no,
        );
        return { success: true };
      }

      // 检查交易状态
      if (notifyData.trade_status === "TRADE_SUCCESS") {
        // 更新支付记录
        paymentRecord.status = "SUCCESS";
        paymentRecord.thirdPartyOrderNo = notifyData.trade_no;
        paymentRecord.paidAt = new Date();
        paymentRecord.details = {
          ...paymentRecord.details,
          notifyData: {
            trade_no: notifyData.trade_no,
            out_trade_no: notifyData.out_trade_no,
            trade_status: notifyData.trade_status,
            total_amount: notifyData.total_amount,
            buyer_id: notifyData.buyer_id,
          },
        };
        await this.paymentRecordRepository.save(paymentRecord);

        // 标记订单为已支付
        await this.orderService.markOrderAsPaid(order.id, "ALIPAY");

        // 处理佣金分配
        await this.commissionService.handleOrderPayment(
          order.id,
          order.amount,
          order.type,
          order.authorId,
          order.userId,
        );

        console.log("支付宝回调处理成功，订单号:", notifyData.out_trade_no);
      } else if (notifyData.trade_status === "TRADE_CLOSED") {
        paymentRecord.status = "FAILED";
        paymentRecord.errorMessage = "交易关闭";
        await this.paymentRecordRepository.save(paymentRecord);
        console.log("支付宝交易关闭，订单号:", notifyData.out_trade_no);
      }

      return { success: true };
    } catch (error) {
      console.error("处理支付宝回调失败:", error);
      return { success: false, message: error.message };
    }
  }

  /**
   * 处理微信支付回调
   */
  async handleWechatNotify(notifyData: WechatNotifyDto) {
    try {
      const wechatPay = this.getWechatPay();

      // 使用微信支付SDK验证回调签名
      const isValid = await (wechatPay as any).verifyNotifySign(notifyData);

      if (!isValid) {
        console.error("微信支付回调签名验证失败");
        return { success: false, message: "签名验证失败" };
      }

      // 查找订单
      const order = await this.orderRepository.findOne({
        where: { orderNo: notifyData.out_trade_no },
      });

      if (!order) {
        console.error("订单不存在:", notifyData.out_trade_no);
        return { success: false, message: "订单不存在" };
      }

      // 查找支付记录
      const paymentRecord = await this.paymentRecordRepository.findOne({
        where: { orderId: order.id },
      });

      if (!paymentRecord) {
        console.error("支付记录不存在，订单ID:", order.id);
        return { success: false, message: "支付记录不存在" };
      }

      // 防止重复处理：检查支付记录是否已经成功
      if (paymentRecord.status === "SUCCESS") {
        console.log(
          "支付已成功，跳过重复处理，订单号:",
          notifyData.out_trade_no,
        );
        return { success: true };
      }

      // 检查交易状态
      if (notifyData.trade_state === "SUCCESS") {
        // 更新支付记录
        paymentRecord.status = "SUCCESS";
        paymentRecord.thirdPartyOrderNo = notifyData.transaction_id;
        paymentRecord.paidAt = new Date();
        paymentRecord.details = {
          ...paymentRecord.details,
          notifyData: {
            transaction_id: notifyData.transaction_id,
            out_trade_no: notifyData.out_trade_no,
            trade_state: notifyData.trade_state,
            amount: notifyData.amount,
            openid: notifyData.openid,
          },
        };
        await this.paymentRecordRepository.save(paymentRecord);

        // 标记订单为已支付
        await this.orderService.markOrderAsPaid(order.id, "WECHAT");

        // 处理佣金分配
        await this.commissionService.handleOrderPayment(
          order.id,
          order.amount,
          order.type,
          order.authorId,
          order.userId,
        );

        console.log("微信支付回调处理成功，订单号:", notifyData.out_trade_no);
      } else {
        paymentRecord.status = "FAILED";
        paymentRecord.errorMessage = `交易失败: ${notifyData.trade_state}`;
        await this.paymentRecordRepository.save(paymentRecord);
        console.log(
          "微信支付交易失败，订单号:",
          notifyData.out_trade_no,
          "状态:",
          notifyData.trade_state,
        );
      }

      return { success: true };
    } catch (error) {
      console.error("处理微信支付回调失败:", error);
      return { success: false, message: error.message };
    }
  }

  /**
   * 处理易支付回调
   */
  async handleEpayNotify(notifyData: EpayNotifyDto) {
    try {
      const epayConfig = this.getEpayConfig();

      // 使用相同的签名验证逻辑
      const signStr = this.getVerifyParams(notifyData);
      const expectedSign = crypto
        .createHash("md5")
        .update(signStr + epayConfig.appKey)
        .digest("hex");

      if (notifyData.sign !== expectedSign) {
        console.error("易支付回调签名验证失败");
        console.error("接收到的签名:", notifyData.sign);
        console.error("计算出的签名:", expectedSign);
        console.error("签名字符串:", signStr);
        return { success: false, message: "签名验证失败" };
      }

      // 查找订单
      const order = await this.orderRepository.findOne({
        where: { orderNo: notifyData.out_trade_no },
      });

      if (!order) {
        console.error("订单不存在:", notifyData.out_trade_no);
        return { success: false, message: "订单不存在" };
      }

      // 查找支付记录
      const paymentRecord = await this.paymentRecordRepository.findOne({
        where: { orderId: order.id },
      });

      if (!paymentRecord) {
        console.error("支付记录不存在，订单ID:", order.id);
        return { success: false, message: "支付记录不存在" };
      }

      // 防止重复处理：检查支付记录是否已经成功
      if (paymentRecord.status === "SUCCESS") {
        console.log(
          "支付已成功，跳过重复处理，订单号:",
          notifyData.out_trade_no,
        );
        return "success";
      }

      // 检查交易状态
      if (notifyData.trade_status === "TRADE_SUCCESS") {
        // 更新支付记录
        paymentRecord.status = "SUCCESS";
        paymentRecord.thirdPartyOrderNo = notifyData.trade_no;
        paymentRecord.paidAt = new Date();
        paymentRecord.details = {
          ...paymentRecord.details,
          notifyData: {
            trade_no: notifyData.trade_no,
            out_trade_no: notifyData.out_trade_no,
            trade_status: notifyData.trade_status,
            money: notifyData.money,
            type: notifyData.type,
            pid: notifyData.pid,
            name: notifyData.name,
          },
        };
        await this.paymentRecordRepository.save(paymentRecord);

        // 标记订单为已支付
        await this.orderService.markOrderAsPaid(order.id, "EPAY");

        // 处理佣金分配
        await this.commissionService.handleOrderPayment(
          order.id,
          order.amount,
          order.type,
          order.authorId,
          order.userId,
        );

        console.log("易支付回调处理成功，订单号:", notifyData.out_trade_no);
      } else {
        paymentRecord.status = "FAILED";
        paymentRecord.errorMessage = `交易失败: ${notifyData.trade_status}`;
        await this.paymentRecordRepository.save(paymentRecord);
        console.log(
          "易支付交易失败，订单号:",
          notifyData.out_trade_no,
          "状态:",
          notifyData.trade_status,
        );
      }

      return "success";
    } catch (error) {
      console.error("处理易支付回调失败:", error);
      return { success: false, message: error.message };
    }
  }

  /**
   * 查询支付记录
   */
  async findPaymentRecord(id: number) {
    const paymentRecord = await this.paymentRecordRepository.findOne({
      where: { id },
      relations: ["order", "user"],
    });

    if (!paymentRecord) {
      throw new NotFoundException("response.error.paymentRecordNotFound");
    }

    return paymentRecord;
  }

  /**
   * 查询订单的支付记录
   */
  async findPaymentByOrderId(orderId: number) {
    const paymentRecord = await this.paymentRecordRepository.findOne({
      where: { orderId },
      relations: ["order", "user"],
    });

    return paymentRecord;
  }

  /**
   * 查询用户的支付记录
   */
  async findUserPayments(userId: number, page: number = 1, limit: number = 10) {
    const [payments, total] = await this.paymentRecordRepository.findAndCount({
      where: { userId },
      relations: ["order"],
      order: { createdAt: "DESC" },
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

    if (paymentRecord.status !== "PENDING") {
      throw new BadRequestException(
        "response.error.paymentRecordStatusIncorrect",
      );
    }

    // 更新支付记录
    paymentRecord.status = "SUCCESS";
    paymentRecord.paidAt = new Date();
    paymentRecord.thirdPartyOrderNo = `SIM_${Date.now()}`;
    await this.paymentRecordRepository.save(paymentRecord);

    // 获取订单信息
    const order = await this.orderRepository.findOne({
      where: { id: paymentRecord.orderId },
    });

    if (!order) {
      throw new NotFoundException("response.error.orderNotFound");
    }

    // 标记订单为已支付
    await this.orderService.markOrderAsPaid(
      paymentRecord.orderId,
      paymentRecord.paymentMethod,
    );

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
      message: "支付成功",
      paymentRecord,
    };
  }

  /**
   * 测试易支付签名计算（用于调试）
   */
  async testEpaySignature(params: any) {
    try {
      const epayConfig = this.getEpayConfig();

      // 使用参考代码的签名计算方法
      const signStr = this.getVerifyParams(params);
      const sign = crypto
        .createHash("md5")
        .update(signStr + epayConfig.appKey)
        .digest("hex");

      return {
        originalParams: params,
        signString: signStr,
        calculatedSign: sign,
        appKey: epayConfig.appKey,
        signStringWithKey: signStr + epayConfig.appKey,
      };
    } catch (error) {
      console.error("测试易支付签名失败:", error);
      throw new BadRequestException("response.error.testEpaySignatureFailed");
    }
  }
}
