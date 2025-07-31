import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  NotFoundException,
  Query,
  Req,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CommissionService } from '../../common/services/commission.service';
import { AuthGuard } from '@nestjs/passport';
import { LoginDto } from './dto/login.dto';
import {
  UserCommissionConfigDto,
  CalculateCommissionDto,
} from '../config/dto/commission-config.dto';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { User } from './entities/user.entity';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PermissionGuard } from 'src/common/guards/permission.guard';
import { SendMailDto } from './dto/send-mail.dto';

@Controller('user')
@ApiTags('用户管理')
@ApiBearerAuth()
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly commissionService: CommissionService,
  ) {}

  @Post('login')
  @ApiOperation({ summary: '用户登录' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: '登录成功，返回JWT token' })
  @ApiResponse({ status: 401, description: '用户名或密码错误' })
  async login(@Body() loginDto: LoginDto, @Req() req: Request) {
    const user = await this.userService.validateUser(loginDto.username, loginDto.password);
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    return this.userService.login(user, req);
  }

  @Post('register')
  @ApiOperation({ summary: '用户注册' })
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({ status: 201, description: '注册成功，返回用户信息' })
  @ApiResponse({ status: 400, description: '请求参数不合法' })
  @ApiResponse({ status: 409, description: '用户名已存在' })
  @ApiResponse({ status: 404, description: '用户不存在' })
  async registerUser(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('user:create')
  @ApiOperation({ summary: '创建用户' })
  @ApiResponse({ status: 201, description: '创建成功' })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '权限不足' })
  create(@Body() createUserDto: CreateUserDto, @Req() req: Request & { user: User }) {
    return this.userService.create(createUserDto, req.user);
  }

  @Get()
  @ApiOperation({ summary: '获取用户列表' })
  @ApiResponse({ status: 200, description: '获取成功' })
  findAll(@Query() pagination: PaginationDto, @Query('username') username?: string) {
    return this.userService.findAllUsers(pagination, username);
  }

  @Get('profile')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: '获取当前用户信息' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 401, description: '未授权' })
  async getProfile(@Req() req: Request & { user: User }) {
    console.log('req.user', req.user);
    return await this.userService.getProfile(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取用户详情' })
  findOne(@Param('id') id: string) {
    return this.userService.findOne(+id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('user:update')
  @ApiOperation({ summary: '更新用户' })
  @ApiResponse({ status: 200, description: '更新成功' })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 404, description: '用户不存在' })
  update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Req() req: Request & { user: User },
  ) {
    return this.userService.updateUser(+id, updateUserDto, req.user);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('user:delete')
  @ApiOperation({ summary: '删除用户' })
  @ApiResponse({ status: 200, description: '删除成功' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 404, description: '用户不存在' })
  remove(@Param('id') id: string, @Req() req: Request & { user: User }) {
    return this.userService.removeUser(+id, req.user);
  }

  @Post('refresh-token')
  @ApiOperation({ summary: '刷新 access token' })
  @ApiBody({ schema: { properties: { refreshToken: { type: 'string' } } } })
  async refreshToken(
    @Body('refreshToken') refreshToken: string,
    @Headers('device-id') deviceId: string,
  ) {
    return this.userService.refreshToken(refreshToken, deviceId);
  }

  @Post('logout')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: '退出登录（单设备）' })
  async logout(@Req() req: Request & { user: User }, @Headers('device-id') deviceId: string) {
    return this.userService.logout(+req.user.id, deviceId);
  }

  @Post(':id/follow')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: '关注用户' })
  async follow(@Param('id') id: string, @Req() req: Request & { user: User }) {
    return this.userService.follow(req.user.id, +id);
  }

  @Post(':id/unfollow')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: '取关用户' })
  async unfollow(@Param('id') id: string, @Req() req: Request & { user: User }) {
    return this.userService.unfollow(req.user.id, +id);
  }

  @Get(':id/followers/count')
  @ApiOperation({ summary: '获取粉丝数量' })
  async getFollowerCount(@Param('id') id: string) {
    return this.userService.getFollowerCount(+id);
  }

  @Get(':id/followings/count')
  @ApiOperation({ summary: '获取关注数量' })
  async getFollowingCount(@Param('id') id: string) {
    return this.userService.getFollowingCount(+id);
  }

  @Get(':id/followers')
  @ApiOperation({ summary: '获取粉丝列表' })
  async getFollowers(@Param('id') id: string, @Query() pagination: PaginationDto) {
    return this.userService.getFollowers(+id, pagination);
  }

  @Get(':id/followings')
  @ApiOperation({ summary: '获取关注列表' })
  async getFollowings(@Param('id') id: string, @Query() pagination: PaginationDto) {
    return this.userService.getFollowings(+id, pagination);
  }

  @Get('commission/config')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: '获取当前用户抽成配置' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 401, description: '未授权' })
  async getUserCommissionConfig(@Req() req: Request & { user: User }) {
    return await this.commissionService.getUserCommissionConfig(req.user.id);
  }

  @Post('commission/config')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('user:manage')
  @ApiOperation({ summary: '设置用户抽成配置' })
  @ApiResponse({ status: 201, description: '设置成功' })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 401, description: '未授权' })
  async setUserCommissionConfig(
    @Req() req: Request & { user: User },
    @Body() config: UserCommissionConfigDto,
  ) {
    const result = await this.commissionService.setUserCommissionConfig(req.user.id, config);
    return { message: '用户抽成配置设置成功', data: result };
  }

  @Post('commission/calculate')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: '计算抽成金额' })
  @ApiResponse({ status: 200, description: '计算成功' })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 401, description: '未授权' })
  async calculateCommission(
    @Req() req: Request & { user: User },
    @Body() data: CalculateCommissionDto,
  ) {
    return await this.commissionService.calculateCommission(req.user.id, data.amount, data.type);
  }

  @Post('wallet/recharge')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: '钱包充值' })
  @ApiResponse({ status: 200, description: '充值成功' })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 401, description: '未授权' })
  async rechargeWallet(
    @Req() req: Request & { user: User },
    @Body() data: { amount: number; paymentMethod: string },
  ) {
    return this.userService.rechargeWallet(req.user.id, data.amount, data.paymentMethod);
  }

  @Post('wallet/withdraw')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: '钱包提现' })
  @ApiResponse({ status: 200, description: '提现成功' })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 401, description: '未授权' })
  async withdrawWallet(
    @Req() req: Request & { user: User },
    @Body() data: { amount: number; bankInfo: any },
  ) {
    return this.userService.withdrawWallet(req.user.id, data.amount, data.bankInfo);
  }

  @Post('email/verification')
  @ApiOperation({ summary: '发送邮箱验证码' })
  @ApiResponse({ status: 200, description: '发送成功' })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 429, description: '请求过多' })
  async sendVerificationCode(@Body() data: SendMailDto) {
    return this.userService.sendVerificationCode(data.email);
  }
}
