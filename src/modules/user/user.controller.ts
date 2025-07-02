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
  Request,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuthGuard } from '@nestjs/passport';
import { LoginDto } from './dto/login.dto';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { User } from './entities/user.entity';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PermissionGuard } from 'src/common/guards/permission.guard';

@Controller('user')
@ApiTags('用户管理')
@ApiBearerAuth()
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) { }

  @Post('login')
  @ApiOperation({ summary: '用户登录' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: '登录成功，返回JWT token' })
  @ApiResponse({ status: 401, description: '用户名或密码错误' })
  async login(@Body() loginDto: LoginDto) {
    const user = await this.userService.validateUser(loginDto.username, loginDto.password);
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    return this.userService.login(user);
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
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: '创建用户' })
  @ApiResponse({ status: 201, description: '创建成功' })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '权限不足' })
  create(
    @Body() createUserDto: CreateUserDto,
    @Request() req: Request & { user: User },
  ) {
    return this.userService.create(createUserDto, req.user);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: '获取用户列表' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 401, description: '未授权' })
  findAll(
    @Query() pagination: PaginationDto,
    @Query('username') username?: string,
  ) {
    return this.userService.findAll(pagination, username);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: '获取用户详情' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 404, description: '用户不存在' })
  findOne(@Param('id') id: string) {
    return this.userService.findOne(+id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: '更新用户' })
  @ApiResponse({ status: 200, description: '更新成功' })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 404, description: '用户不存在' })
  update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Request() req: Request & { user: User },
  ) {
    return this.userService.update(+id, updateUserDto, req.user);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: '删除用户' })
  @ApiResponse({ status: 200, description: '删除成功' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 404, description: '用户不存在' })
  remove(@Param('id') id: string, @Request() req: Request & { user: User }) {
    return this.userService.remove(+id, req.user);
  }

  @Post('refresh-token')
  @ApiOperation({ summary: '刷新 access token' })
  @ApiBody({ schema: { properties: { refreshToken: { type: 'string' } } } })
  async refreshToken(@Body('refreshToken') refreshToken: string) {
    return this.userService.refreshToken(refreshToken);
  }

  @Post('logout')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: '退出登录' })
  async logout(@Request() req) {
    return this.userService.logout(req.user.id);
  }

  @Get('profile')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: '获取当前用户信息' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 401, description: '未授权' })
  async getProfile(@Request() req: Request & { user: User }) {
    return {
      message: '认证成功',
      user: {
        id: req.user.id,
        username: req.user.username,
        roles: req.user.roles.map(role => role.name),
        permissions: req.user.roles.flatMap(role => role.permissions.map(p => p.name))
      }
    };
  }

  @Get('test-auth')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: '测试 JWT 认证（不使用 RBAC）' })
  @ApiResponse({ status: 200, description: '认证成功' })
  @ApiResponse({ status: 401, description: '未授权' })
  async testAuth(@Request() req: Request & { user: User }) {
    return {
      message: 'JWT 认证成功',
      user: {
        id: req.user.id,
        username: req.user.username,
        roles: req.user.roles.map(role => role.name)
      },
      timestamp: new Date().toISOString()
    };
  }

  @Get('test-jwt')
  @ApiOperation({ summary: '直接测试 JWT 解析' })
  @ApiResponse({ status: 200, description: '解析成功' })
  @ApiResponse({ status: 400, description: '解析失败' })
  async testJwt(@Request() req: Request) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        error: 'Missing or invalid Authorization header',
        expected: 'Bearer <token>',
        received: authHeader
      };
    }

    const token = authHeader.substring(7);
    const secret = this.configService.get<string>('JWT_SECRET', 'your-secret-key');
    
    try {
      const payload = this.jwtService.verify(token, { secret });
      return {
        success: true,
        payload,
        secret: secret ? '已设置' : '未设置',
        token: token.substring(0, 20) + '...'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        secret: secret ? '已设置' : '未设置',
        token: token.substring(0, 20) + '...'
      };
    }
  }
}
