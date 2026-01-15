import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { PointsService } from './points.service';
import { AddPointsDto } from './dto/add-points.dto';
import { SpendPointsDto } from './dto/spend-points.dto';
import { QueryPointsTransactionDto } from './dto/query-points-transaction.dto';
import { CreatePointsRuleDto } from './dto/create-points-rule.dto';
import { UpdatePointsRuleDto } from './dto/update-points-rule.dto';
import { CreatePointsTaskDto } from './dto/create-points-task.dto';
import { UpdatePointsTaskDto } from './dto/update-points-task.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { PermissionGuard } from 'src/common/guards/permission.guard';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { NoAuth } from 'src/common/decorators/no-auth.decorator';
import { User } from '../user/entities/user.entity';

@ApiTags('积分管理')
@Controller('points')
@ApiBearerAuth()
export class PointsController {
  constructor(private readonly pointsService: PointsService) { }

  @Post('add')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('points:manage')
  @ApiOperation({ summary: '增加积分（管理员）' })
  @ApiResponse({ status: 200, description: '增加成功' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '权限不足' })
  async addPoints(@Req() req: Request & { user: User }, @Body() addPointsDto: AddPointsDto) {
    return this.pointsService.addPoints(req.user.id, addPointsDto);
  }

  @Post('spend')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('points:manage')
  @ApiOperation({ summary: '消费积分（管理员）' })
  @ApiResponse({ status: 200, description: '消费成功' })
  @ApiResponse({ status: 400, description: '积分不足' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '权限不足' })
  async spendPoints(@Req() req, @Body() spendPointsDto: SpendPointsDto) {
    return this.pointsService.spendPoints(req.user.id, spendPointsDto);
  }

  @Get('transactions')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('points:view')
  @ApiOperation({ summary: '获取积分交易记录' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '权限不足' })
  async getTransactions(@Req() req: Request & { user: User }, @Query() queryDto: QueryPointsTransactionDto) {
    return this.pointsService.getTransactions(req.user.id, queryDto);
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('points:view')
  @ApiOperation({ summary: '获取积分统计信息' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '权限不足' })
  async getStats(@Req() req: Request & { user: User }) {
    return this.pointsService.getPointsStats(req.user.id);
  }

  @Post('rules')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('points:manage')
  @ApiOperation({ summary: '创建积分规则' })
  @ApiResponse({ status: 201, description: '创建成功' })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '权限不足' })
  async createRule(@Body() createRuleDto: CreatePointsRuleDto) {
    return this.pointsService.createRule(createRuleDto);
  }

  @Get('rules')
  @UseGuards(JwtAuthGuard)
  @NoAuth()
  @ApiOperation({ summary: '获取所有积分规则' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async findAllRules() {
    return this.pointsService.findAllRules();
  }

  @Get('rules/:id')
  @UseGuards(JwtAuthGuard)
  @NoAuth()
  @ApiOperation({ summary: '获取积分规则详情' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 404, description: '规则不存在' })
  async findOneRule(@Param('id') id: string) {
    return this.pointsService.findOneRule(+id);
  }

  @Patch('rules/:id')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('points:manage')
  @ApiOperation({ summary: '更新积分规则' })
  @ApiResponse({ status: 200, description: '更新成功' })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '权限不足' })
  @ApiResponse({ status: 404, description: '规则不存在' })
  async updateRule(@Param('id') id: string, @Body() updateRuleDto: UpdatePointsRuleDto) {
    return this.pointsService.updateRule(+id, updateRuleDto);
  }

  @Delete('rules/:id')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('points:manage')
  @ApiOperation({ summary: '删除积分规则' })
  @ApiResponse({ status: 200, description: '删除成功' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '权限不足' })
  @ApiResponse({ status: 404, description: '规则不存在' })
  async removeRule(@Param('id') id: string) {
    return this.pointsService.removeRule(+id);
  }

  @Post('tasks')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('points:manage')
  @ApiOperation({ summary: '创建积分任务' })
  @ApiResponse({ status: 201, description: '创建成功' })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '权限不足' })
  async createTask(@Body() createTaskDto: CreatePointsTaskDto) {
    return this.pointsService.createTask(createTaskDto);
  }

  @Get('tasks')
  @UseGuards(JwtAuthGuard)
  @NoAuth()
  @ApiOperation({ summary: '获取所有积分任务' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async findAllTasks(@Req() req) {
    return this.pointsService.findAllTasks(req.user?.id);
  }

  @Get('tasks/:id')
  @UseGuards(JwtAuthGuard)
  @NoAuth()
  @ApiOperation({ summary: '获取积分任务详情' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 404, description: '任务不存在' })
  async findOneTask(@Param('id') id: string) {
    return this.pointsService.findOneTask(+id);
  }

  @Patch('tasks/:id')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('points:manage')
  @ApiOperation({ summary: '更新积分任务' })
  @ApiResponse({ status: 200, description: '更新成功' })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '权限不足' })
  @ApiResponse({ status: 404, description: '任务不存在' })
  async updateTask(@Param('id') id: string, @Body() updateTaskDto: UpdatePointsTaskDto) {
    return this.pointsService.updateTask(+id, updateTaskDto);
  }

  @Delete('tasks/:id')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('points:manage')
  @ApiOperation({ summary: '删除积分任务' })
  @ApiResponse({ status: 200, description: '删除成功' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '权限不足' })
  @ApiResponse({ status: 404, description: '任务不存在' })
  async removeTask(@Param('id') id: string) {
    return this.pointsService.removeTask(+id);
  }

  @Post('tasks/:id/claim')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('points:claim')
  @ApiOperation({ summary: '领取任务奖励' })
  @ApiResponse({ status: 200, description: '领取成功' })
  @ApiResponse({ status: 400, description: '任务未完成或已领取' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '权限不足' })
  @ApiResponse({ status: 404, description: '任务不存在' })
  async claimTaskReward(@Req() req, @Param('id') id: string) {
    return this.pointsService.claimTaskReward(req.user.id, +id);
  }
}
