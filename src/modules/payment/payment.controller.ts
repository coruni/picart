import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { AlipayNotifyDto, WechatNotifyDto } from './dto/payment-notify.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { NoAuth } from '../../common/decorators/no-auth.decorator';

@ApiTags('支付')
@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('create')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建支付' })
  @ApiResponse({ status: 201, description: '支付创建成功' })
  async createPayment(@Body() createPaymentDto: CreatePaymentDto, @Req() req: any) {
    const userId = req.user.id;
    return await this.paymentService.createPayment(createPaymentDto, userId);
  }

  @Post('notify/alipay')
  @NoAuth()
  @ApiOperation({ summary: '支付宝支付回调' })
  @ApiResponse({ status: 200, description: '回调处理成功' })
  async alipayNotify(@Body() notifyData: AlipayNotifyDto) {
    return await this.paymentService.handleAlipayNotify(notifyData);
  }

  @Post('notify/wechat')
  @NoAuth()
  @ApiOperation({ summary: '微信支付回调' })
  @ApiResponse({ status: 200, description: '回调处理成功' })
  async wechatNotify(@Body() notifyData: WechatNotifyDto) {
    return await this.paymentService.handleWechatNotify(notifyData);
  }

  @Get('record/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '查询支付记录' })
  @ApiResponse({ status: 200, description: '查询成功' })
  async findPaymentRecord(@Param('id') id: number) {
    return await this.paymentService.findPaymentRecord(id);
  }

  @Get('order/:orderId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '查询订单支付记录' })
  @ApiResponse({ status: 200, description: '查询成功' })
  async findPaymentByOrderId(@Param('orderId') orderId: number) {
    return await this.paymentService.findPaymentByOrderId(orderId);
  }

  @Get('user')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '查询用户支付记录' })
  @ApiResponse({ status: 200, description: '查询成功' })
  async findUserPayments(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Req() req: any,
  ) {
    const userId = req.user.id;
    return await this.paymentService.findUserPayments(userId, page, limit);
  }

  @Post('simulate/:id/success')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '模拟支付成功（仅用于测试）' })
  @ApiResponse({ status: 200, description: '模拟成功' })
  async simulatePaymentSuccess(@Param('id') id: number) {
    return await this.paymentService.simulatePaymentSuccess(id);
  }
}
