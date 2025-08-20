import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
  Put,
  Delete,
  NotFoundException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { OrderService } from "./order.service";
import { UserService } from "../user/user.service";
import { AuthGuard } from "@nestjs/passport";
import { Permissions } from "src/common/decorators/permissions.decorator";
import { PermissionGuard } from "src/common/guards/permission.guard";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CreateArticleOrderDto } from "./dto/create-article-order.dto";
import { CreateMembershipOrderDto } from "./dto/create-membership-order.dto";
import { QueryOrdersDto } from "./dto/query-orders.dto";
import { AdminQueryOrdersDto } from "./dto/admin-query-orders.dto";

@Controller("order")
@ApiTags("订单管理")
@ApiBearerAuth()
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly userService: UserService,
  ) {}

  @Get()
  @UseGuards(AuthGuard("jwt"), PermissionGuard)
  @Permissions("order:manage")
  @ApiOperation({ summary: "获取所有订单列表（管理员权限）" })
  @ApiResponse({ status: 200, description: "获取成功" })
  getAllOrders(@Query() adminQueryOrdersDto: AdminQueryOrdersDto) {
    return this.orderService.getAllOrders(adminQueryOrdersDto);
  }

  @Get("user")
  @UseGuards(AuthGuard("jwt"), PermissionGuard)
  @Permissions("order:read")
  @ApiOperation({ summary: "获取用户订单列表" })
  @ApiResponse({ status: 200, description: "获取成功" })
  getUserOrders(@Request() req, @Query() queryOrdersDto: QueryOrdersDto) {
    return this.orderService.getUserOrders(
      req.user.id,
      queryOrdersDto.page,
      queryOrdersDto.limit,
      queryOrdersDto.status,
      queryOrdersDto.type,
    );
  }

  @Get("pending")
  @UseGuards(AuthGuard("jwt"))
  @ApiOperation({ summary: "获取待支付订单" })
  @ApiResponse({ status: 200, description: "获取成功" })
  getPendingOrders(@Request() req) {
    return this.orderService.getPendingOrders(req.user.id);
  }

  @Get(":id")
  @UseGuards(AuthGuard("jwt"), PermissionGuard)
  @Permissions("order:read")
  @ApiOperation({ summary: "获取订单详情" })
  @ApiResponse({ status: 200, description: "获取成功" })
  @ApiResponse({ status: 404, description: "订单不存在" })
  findOne(@Param("id") id: string) {
    return this.orderService.findOne(+id);
  }

  @Get("no/:orderNo")
  @UseGuards(AuthGuard("jwt"), PermissionGuard)
  @Permissions("order:read")
  @ApiOperation({ summary: "根据订单号获取订单" })
  @ApiResponse({ status: 200, description: "获取成功" })
  @ApiResponse({ status: 404, description: "订单不存在" })
  findByOrderNo(@Param("orderNo") orderNo: string, @Request() req) {
    return this.orderService.findByOrderNo(orderNo, req.user);
  }

  @Put(":id/cancel")
  @UseGuards(AuthGuard("jwt"), PermissionGuard)
  @Permissions("order:cancel")
  @ApiOperation({ summary: "取消订单" })
  @ApiResponse({ status: 200, description: "取消成功" })
  @ApiResponse({ status: 400, description: "请求参数错误" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 404, description: "订单不存在" })
  async cancelOrder(@Param("id") id: string, @Request() req) {
    return await this.orderService.cancelOrder(+id, req.user.id);
  }

  @Post(":id/refund")
  @UseGuards(AuthGuard("jwt"), PermissionGuard)
  @Permissions("order:refund")
  @ApiOperation({ summary: "申请退款" })
  @ApiResponse({ status: 200, description: "申请成功" })
  @ApiResponse({ status: 400, description: "请求参数错误" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 404, description: "订单不存在" })
  async requestRefund(
    @Param("id") id: string,
    @Request() req,
    @Body("reason") reason: string,
  ) {
    return await this.orderService.requestRefund(+id, req.user.id, reason);
  }

  @Post("article")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "创建文章订单" })
  @ApiResponse({ status: 201, description: "创建成功" })
  @ApiResponse({ status: 400, description: "请求参数错误" })
  @ApiResponse({ status: 401, description: "未授权" })
  async createArticleOrder(
    @Request() req,
    @Body() createArticleOrderDto: CreateArticleOrderDto,
  ) {
    return await this.orderService.createArticleOrder(
      req.user.id,
      createArticleOrderDto,
    );
  }

  @Post("membership")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "创建会员充值订单" })
  @ApiResponse({ status: 201, description: "创建成功" })
  @ApiResponse({ status: 400, description: "请求参数错误" })
  @ApiResponse({ status: 401, description: "未授权" })
  async createMembershipOrder(
    @Request() req,
    @Body() createMembershipOrderDto: CreateMembershipOrderDto,
  ) {
    return await this.orderService.createMembershipOrder(
      req.user.id,
      createMembershipOrderDto,
    );
  }

  @Get("wallet/balance")
  @UseGuards(AuthGuard("jwt"))
  @ApiOperation({ summary: "获取钱包余额" })
  @ApiResponse({ status: 200, description: "获取成功" })
  @ApiResponse({ status: 401, description: "未授权" })
  async getWalletBalance(@Request() req) {
    const user = await this.userService.findOneById(req.user.id);
    if (!user) throw new NotFoundException("response.error.userNotFound");
    return {
      wallet: user.wallet,
      userId: user.id,
    };
  }
}
