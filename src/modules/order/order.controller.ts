import { Controller, Get, Post, Body, Param, UseGuards, Request, Query, Put, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { OrderService } from './order.service';
import { UserService } from '../user/user.service';
import { AuthGuard } from '@nestjs/passport';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { PermissionGuard } from 'src/common/guards/permission.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateArticleOrderDto } from './dto/create-article-order.dto';
import { CreateMembershipOrderDto } from './dto/create-membership-order.dto';

@Controller('order')
@ApiTags('订单管理')
@ApiBearerAuth()
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly userService: UserService,
  ) {}

  @Get()
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('order:read')
  @ApiOperation({ summary: '获取用户订单列表' })
  @ApiResponse({ status: 200, description: '获取成功' })
  getUserOrders(
    @Request() req,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    return this.orderService.getUserOrders(req.user.id, parseInt(page), parseInt(limit));
  }

  @Get('pending')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: '获取待支付订单' })
  @ApiResponse({ status: 200, description: '获取成功' })
  getPendingOrders(@Request() req) {
    return this.orderService.getPendingOrders(req.user.id);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('order:read')
  @ApiOperation({ summary: '获取订单详情' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 404, description: '订单不存在' })
  findOne(@Param('id') id: string) {
    return this.orderService.findOne(+id);
  }

  @Get('no/:orderNo')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: '根据订单号获取订单' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 404, description: '订单不存在' })
  findByOrderNo(@Param('orderNo') orderNo: string) {
    return this.orderService.findByOrderNo(orderNo);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: '创建订单（包含抽成计算）' })
  @ApiResponse({ status: 201, description: '创建成功' })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 401, description: '未授权' })
  async createOrder(
    @Request() req,
    @Body()
    orderData: {
      type: string;
      amount: number;
      authorId: number;
      targetId?: number;
      details?: any;
    },
  ) {
    return await this.orderService.createOrderWithCommission(orderData, req.user.id);
  }

  @Post('payment')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: '创建支付订单' })
  @ApiResponse({ status: 201, description: '创建成功' })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 401, description: '未授权' })
  async createPaymentOrder(
    @Request() req,
    @Body()
    orderData: {
      type: string;
      title: string;
      amount: number;
      authorId: number;
      details?: any;
    },
  ) {
    return await this.orderService.createPaymentOrder(
      req.user.id,
      orderData.authorId,
      orderData.type,
      orderData.title,
      orderData.amount,
      orderData.details,
    );
  }

  @Put(':id/cancel')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: '取消订单' })
  @ApiResponse({ status: 200, description: '取消成功' })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 404, description: '订单不存在' })
  async cancelOrder(
    @Param('id') id: string,
    @Request() req,
  ) {
    return await this.orderService.cancelOrder(+id, req.user.id);
  }

  @Post(':id/refund')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: '申请退款' })
  @ApiResponse({ status: 200, description: '申请成功' })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 404, description: '订单不存在' })
  async requestRefund(
    @Param('id') id: string,
    @Request() req,
    @Body() refundData: { reason: string },
  ) {
    return await this.orderService.requestRefund(+id, req.user.id, refundData.reason);
  }

  @Post('article')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '创建文章订单' })
  @ApiResponse({ status: 201, description: '创建成功' })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 401, description: '未授权' })
  async createArticleOrder(
    @Request() req,
    @Body() createArticleOrderDto: CreateArticleOrderDto,
  ) {
    return await this.orderService.createArticleOrder(req.user.id, createArticleOrderDto);
  }

  @Post('membership')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '创建会员充值订单' })
  @ApiResponse({ status: 201, description: '创建成功' })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 401, description: '未授权' })
  async createMembershipOrder(
    @Request() req,
    @Body() createMembershipOrderDto: CreateMembershipOrderDto,
  ) {
    return await this.orderService.createMembershipOrder(req.user.id, createMembershipOrderDto);
  }

  @Get('wallet/balance')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: '获取钱包余额' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 401, description: '未授权' })
  async getWalletBalance(@Request() req) {
    const user = await this.userService.findOne(req.user.id);
    return {
      wallet: user.wallet,
      userId: user.id,
    };
  }
}
