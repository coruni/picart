import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
  Req,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiQuery,
} from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { DecorationService } from "./decoration.service";
import { CreateDecorationDto } from "./dto/create-decoration.dto";
import { UpdateDecorationDto } from "./dto/update-decoration.dto";
import { CreateActivityDto } from "./dto/create-activity.dto";
import { UpdateActivityDto } from "./dto/update-activity.dto";
import { PurchaseDecorationDto } from "./dto/purchase-decoration.dto";
import { GiftDecorationDto } from "./dto/gift-decoration.dto";
import { PaginationDto } from "src/common/dto/pagination.dto";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { PermissionGuard } from "../../common/guards/permission.guard";
import { JwtAuthGuard } from "src/common/guards/jwt-auth.guard";
import { User } from "../user/entities/user.entity";
import { PermissionUtil } from "../../common/utils/permission.util";

@ApiTags("装饰品管理")
@Controller("decoration")
@ApiBearerAuth()
export class DecorationController {
  constructor(private readonly decorationService: DecorationService) {}

  @Post()
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions("decoration:manage")
  @ApiOperation({ summary: "创建装饰品" })
  @ApiResponse({ status: 201, description: "创建成功" })
  create(@Body() createDecorationDto: CreateDecorationDto) {
    return this.decorationService.create(createDecorationDto);
  }

  @Get()
  @ApiOperation({ summary: "获取装饰品列表" })
  @UseGuards(JwtAuthGuard)
  @ApiQuery({ name: "type", required: false, description: "装饰品类型" })
  @ApiQuery({
    name: "status",
    required: false,
    description: "状态（管理员可查询，普通用户默认ACTIVE）",
  })
  @ApiQuery({ name: "keyword", required: false, description: "关键词搜索" })
  @ApiResponse({ status: 200, description: "获取成功" })
  findAll(
    @Request() req: Request & { user: User },
    @Query("type") type?: string,
    @Query("status") status?: string,
    @Query("keyword") keyword?: string,
    @Query() pagination?: PaginationDto,
    @Query("sortBy") sortBy?: string,
    @Query("sortOrder") sortOrder?: "ASC" | "DESC",
  ) {
    // 检查用户是否有 decoration:manage 权限
    const isAdmin = PermissionUtil.hasPermission(req.user, "decoration:manage");

    // 非管理员只能查看 ACTIVE 状态
    const effectiveStatus = isAdmin ? status : "ACTIVE";

    return this.decorationService.findAll(
      req.user.id,
      type,
      effectiveStatus,
      keyword,
      pagination?.page || 1,
      pagination?.limit || 20,
      sortBy,
      sortOrder,
    );
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "获取装饰品详情" })
  @ApiResponse({ status: 200, description: "获取成功" })
  findOne(@Param("id") id: string, @Request() req: Request & { user: User }) {
    return this.decorationService.findOne(+id, req.user?.id);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions("decoration:manage")
  @ApiOperation({ summary: "更新装饰品" })
  @ApiResponse({ status: 200, description: "更新成功" })
  update(
    @Param("id") id: string,
    @Body() updateDecorationDto: UpdateDecorationDto,
  ) {
    return this.decorationService.update(+id, updateDecorationDto);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions("decoration:manage")
  @ApiOperation({ summary: "删除装饰品" })
  @ApiResponse({ status: 200, description: "删除成功" })
  remove(@Param("id") id: string) {
    return this.decorationService.remove(+id);
  }

  @Post("purchase")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "购买装饰品" })
  @ApiResponse({ status: 200, description: "购买成功" })
  purchase(
    @Request() req: Request & { user: User },
    @Body() purchaseDto: PurchaseDecorationDto,
  ) {
    return this.decorationService.purchase(req.user.id, purchaseDto);
  }

  @Post("gift")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "赠送装饰品" })
  @ApiResponse({ status: 200, description: "赠送成功" })
  gift(
    @Request() req: Request & { user: User },
    @Body() giftDto: GiftDecorationDto,
  ) {
    return this.decorationService.gift(req.user.id, giftDto);
  }

  @Get("user/my")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "获取我的装饰品" })
  @ApiResponse({ status: 200, description: "获取成功" })
  getMyDecorations(
    @Request() req: Request & { user: User },
    @Query("type") type?: string,
    @Query() pagination?: PaginationDto,
  ) {
    return this.decorationService.getUserDecorations(
      req.user.id,
      type,
      pagination?.page || 1,
      pagination?.limit || 20,
    );
  }

  @Get("user/:userId")
  @ApiOperation({ summary: "获取用户的装饰品" })
  @ApiResponse({ status: 200, description: "获取成功" })
  getUserDecorations(
    @Param("userId") userId: string,
    @Query("type") type?: string,
    @Query() pagination?: PaginationDto,
  ) {
    return this.decorationService.getUserDecorations(
      +userId,
      type,
      pagination?.page || 1,
      pagination?.limit || 20,
    );
  }

  @Post("use/:decorationId")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "使用装饰品" })
  @ApiResponse({ status: 200, description: "装备成功" })
  useDecoration(
    @Request() req: Request & { user: User },
    @Param("decorationId") decorationId: string,
  ) {
    return this.decorationService.useDecoration(req.user.id, +decorationId);
  }

  @Post("unuse/:decorationId")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "取消使用装饰品" })
  @ApiResponse({ status: 200, description: "取消成功" })
  unuseDecoration(
    @Request() req: Request & { user: User },
    @Param("decorationId") decorationId: string,
  ) {
    return this.decorationService.unuseDecoration(req.user.id, +decorationId);
  }

  @Get("user/current/decorations")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "获取当前使用的装饰品" })
  @ApiResponse({ status: 200, description: "获取成功" })
  getCurrentDecorations(@Request() req: Request & { user: User }) {
    return this.decorationService.getCurrentDecorations(req.user.id);
  }

  // ========== 活动管理接口（管理员） ==========

  @Post("activity")
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions("decoration:manage")
  @ApiOperation({ summary: "创建活动" })
  @ApiResponse({ status: 201, description: "创建成功" })
  createActivity(@Body() createActivityDto: CreateActivityDto) {
    return this.decorationService.createActivity(createActivityDto);
  }

  @Get("activity")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "获取活动列表" })
  @ApiQuery({ name: "status", required: false, description: "状态筛选" })
  @ApiQuery({ name: "type", required: false, description: "类型筛选" })
  @ApiResponse({ status: 200, description: "获取成功" })
  findAllActivities(
    @Query("status") status?: string,
    @Query("type") type?: string,
    @Query() pagination?: PaginationDto,
  ) {
    return this.decorationService.findAllActivities(
      status,
      type,
      pagination?.page || 1,
      pagination?.limit || 20,
    );
  }

  @Get("activity/:id")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "获取活动详情" })
  @ApiResponse({ status: 200, description: "获取成功" })
  findOneActivity(@Param("id") id: string) {
    return this.decorationService.findOneActivity(+id);
  }

  @Patch("activity/:id")
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions("decoration:manage")
  @ApiOperation({ summary: "更新活动" })
  @ApiResponse({ status: 200, description: "更新成功" })
  updateActivity(
    @Param("id") id: string,
    @Body() updateActivityDto: UpdateActivityDto,
  ) {
    return this.decorationService.updateActivity(+id, updateActivityDto);
  }

  @Delete("activity/:id")
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions("decoration:manage")
  @ApiOperation({ summary: "删除活动" })
  @ApiResponse({ status: 200, description: "删除成功" })
  removeActivity(@Param("id") id: string) {
    return this.decorationService.removeActivity(+id);
  }

  @Post("activity/claim/:activityId")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "领取活动奖励" })
  @ApiResponse({ status: 200, description: "领取成功" })
  claimActivityReward(
    @Request() req: Request & { user: User },
    @Param("activityId") activityId: string,
  ) {
    return this.decorationService.claimActivityReward(req.user.id, +activityId);
  }

  @Get("activity/progress/my")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "获取我的活动进度" })
  @ApiResponse({ status: 200, description: "获取成功" })
  getMyActivityProgress(@Request() req: Request & { user: User }) {
    return this.decorationService.getUserActivityProgress(req.user.id);
  }

  @Post("clean-expired")
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions("decoration:manage")
  @ApiOperation({ summary: "清理过期装饰品" })
  @ApiResponse({ status: 200, description: "清理成功" })
  cleanExpired() {
    return this.decorationService.cleanExpiredDecorations();
  }

  @Get("achievement-badges/my")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "获取我的成就勋章" })
  @ApiResponse({ status: 200, description: "获取成功" })
  getMyAchievementBadges(
    @Request() req: Request & { user: User },
    @Query() pagination?: PaginationDto,
  ) {
    return this.decorationService.getUserAchievementBadges(
      req.user.id,
      pagination?.page || 1,
      pagination?.limit || 20,
    );
  }
}
