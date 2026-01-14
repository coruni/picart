import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  Res,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { Response } from "express";
import { PaymentService } from "./payment.service";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import {
  AlipayNotifyDto,
  EpayNotifyDto,
  WechatNotifyDto,
} from "./dto/payment-notify.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { NoAuth } from "../../common/decorators/no-auth.decorator";

@ApiTags("支付管理")
@Controller("payment")
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post("create")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "创建支付" })
  @ApiResponse({ status: 201, description: "支付创建成功" })
  async createPayment(
    @Body() createPaymentDto: CreatePaymentDto,
    @Req() req: any,
  ) {
    const userId = req.user.id;
    return await this.paymentService.createPayment(createPaymentDto, userId);
  }

  @Post("notify/alipay")
  @NoAuth()
  @ApiOperation({ summary: "支付宝支付回调" })
  @ApiResponse({ status: 200, description: "回调处理成功" })
  async alipayNotify(@Body() notifyData: AlipayNotifyDto) {
    return await this.paymentService.handleAlipayNotify(notifyData);
  }

  @Post("notify/wechat")
  @NoAuth()
  @ApiOperation({ summary: "微信支付回调" })
  @ApiResponse({ status: 200, description: "回调处理成功" })
  async wechatNotify(@Body() notifyData: WechatNotifyDto) {
    return await this.paymentService.handleWechatNotify(notifyData);
  }

  @Get("record/:id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "查询支付记录" })
  @ApiResponse({ status: 200, description: "查询成功" })
  async findPaymentRecord(@Param("id") id: number) {
    return await this.paymentService.findPaymentRecord(id);
  }

  @Get("order/:orderId")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "查询订单支付记录" })
  @ApiResponse({ status: 200, description: "查询成功" })
  async findPaymentByOrderId(@Param("orderId") orderId: number) {
    return await this.paymentService.findPaymentByOrderId(orderId);
  }

  @Get("user")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "查询用户支付记录" })
  @ApiResponse({ status: 200, description: "查询成功" })
  async findUserPayments(
    @Query("page") page: number = 1,
    @Query("limit") limit: number = 10,
    @Req() req: any,
  ) {
    const userId = req.user.id;
    return await this.paymentService.findUserPayments(userId, page, limit);
  }

  // 易支付支付回调
  @Get("notify/epay")
  @NoAuth()
  @ApiOperation({ summary: "易支付支付回调" })
  @ApiResponse({ status: 200, description: "回调处理成功" })
  async epayNotify(@Query() query: EpayNotifyDto, @Res() res: Response) {
    const result = await this.paymentService.handleEpayNotify(query);
    
    // 易支付需要直接返回字符串 "success"
    if (result === true) {
      return res.status(200).send("success");
    } else {
      // 如果处理失败，返回错误信息
      return res.status(200).json(result);
    }
  }

  // 测试易支付签名（仅用于调试）
  @Post("test/epay-signature")
  @NoAuth()
  @ApiOperation({ summary: "测试易支付签名计算" })
  @ApiResponse({ status: 200, description: "签名计算成功" })
  async testEpaySignature(@Body() params: any) {
    return await this.paymentService.testEpaySignature(params);
  }
}
