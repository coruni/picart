import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PointsService } from './points.service';
import { AddPointsDto } from './dto/add-points.dto';
import { SpendPointsDto } from './dto/spend-points.dto';
import { QueryPointsTransactionDto } from './dto/query-points-transaction.dto';
import { CreatePointsActivityDto } from './dto/create-points-activity.dto';
import { UpdatePointsActivityDto } from './dto/update-points-activity.dto';
import { User } from '../user/entities/user.entity';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { PermissionGuard } from 'src/common/guards/permission.guard';
import { Permissions } from 'src/common/decorators/permissions.decorator';

@ApiTags('积分管理')
@Controller('points')
export class PointsController {
  constructor(private readonly pointsService: PointsService) {}

  @Post('add')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('points:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: '增加积分' })
  @ApiResponse({ status: 201, description: '积分增加成功' })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '权限不足' })
  async addPoints(@Body() addPointsDto: AddPointsDto, @Request() req: { user: User }) {
    return this.pointsService.addPoints(req.user.id, addPointsDto);
  }

  @Post('spend')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '消费积分' })
  @ApiResponse({ status: 201, description: '积分消费成功' })
  @ApiResponse({ status: 400, description: '积分不足或请求参数错误' })
  @ApiResponse({ status: 401, description: '未授权' })
  async spendPoints(@Body() spendPointsDto: SpendPointsDto, @Request() req: { user: User }) {
    return this.pointsService.spendPoints(req.user.id, spendPointsDto);
  }

  @Get('balance')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取积分余额' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 401, description: '未授权' })
  async getBalance(@Request() req: { user: User }) {
    return this.pointsService.getBalance(req.user.id);
  }

  @Get('transactions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取积分交易记录' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 401, description: '未授权' })
  async getTransactions(
    @Query() queryDto: QueryPointsTransactionDto,
    @Request() req: { user: User },
  ) {
    return this.pointsService.getTransactions(req.user.id, queryDto);
  }

  // ==================== 积分活动管理 ====================

  @Post('activities')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('points:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建积分活动' })
  @ApiResponse({ status: 201, description: '活动创建成功' })
  @ApiResponse({ status: 400, description: '活动代码已存在或请求参数错误' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '权限不足' })
  async createActivity(@Body() createActivityDto: CreatePointsActivityDto) {
    return this.pointsService.createActivity(createActivityDto);
  }

  @Get('activities')
  @ApiOperation({ summary: '获取积分活动列表' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async findAllActivities(@Query('type') type?: string) {
    return this.pointsService.findAllActivities(type);
  }

  @Get('activities/:id')
  @ApiOperation({ summary: '获取积分活动详情' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 404, description: '活动不存在' })
  async findOneActivity(@Param('id') id: string) {
    return this.pointsService.findOneActivity(+id);
  }

  @Patch('activities/:id')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('points:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新积分活动' })
  @ApiResponse({ status: 200, description: '活动更新成功' })
  @ApiResponse({ status: 400, description: '活动代码已存在或请求参数错误' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '权限不足' })
  @ApiResponse({ status: 404, description: '活动不存在' })
  async updateActivity(@Param('id') id: string, @Body() updateActivityDto: UpdatePointsActivityDto) {
    return this.pointsService.updateActivity(+id, updateActivityDto);
  }

  @Delete('activities/:id')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('points:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除积分活动' })
  @ApiResponse({ status: 200, description: '活动删除成功' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '权限不足' })
  @ApiResponse({ status: 404, description: '活动不存在' })
  async removeActivity(@Param('id') id: string) {
    return this.pointsService.removeActivity(+id);
  }

  @Post('activities/:id/claim')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '领取任务奖励' })
  @ApiResponse({ status: 201, description: '奖励领取成功' })
  @ApiResponse({ status: 400, description: '任务未完成或已领取' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 404, description: '任务记录不存在' })
  async claimTaskReward(@Param('id') id: string, @Request() req: { user: User }) {
    return this.pointsService.claimTaskReward(req.user.id, +id);
  }
}