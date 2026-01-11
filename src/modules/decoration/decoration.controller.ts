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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { DecorationService } from './decoration.service';
import { CreateDecorationDto } from './dto/create-decoration.dto';
import { UpdateDecorationDto } from './dto/update-decoration.dto';
import { PurchaseDecorationDto } from './dto/purchase-decoration.dto';
import { GiftDecorationDto } from './dto/gift-decoration.dto';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';

@ApiTags('装饰品管理')
@Controller('decoration')
@ApiBearerAuth()
export class DecorationController {
  constructor(private readonly decorationService: DecorationService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('decoration:manage')
  @ApiOperation({ summary: '创建装饰品' })
  @ApiResponse({ status: 201, description: '创建成功' })
  create(@Body() createDecorationDto: CreateDecorationDto) {
    return this.decorationService.create(createDecorationDto);
  }

  @Get()
  @ApiOperation({ summary: '获取装饰品列表' })
  @ApiResponse({ status: 200, description: '获取成功' })
  findAll(@Query('type') type?: string, @Query('status') status?: string) {
    return this.decorationService.findAll(type, status);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取装饰品详情' })
  @ApiResponse({ status: 200, description: '获取成功' })
  findOne(@Param('id') id: string) {
    return this.decorationService.findOne(+id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('decoration:manage')
  @ApiOperation({ summary: '更新装饰品' })
  @ApiResponse({ status: 200, description: '更新成功' })
  update(@Param('id') id: string, @Body() updateDecorationDto: UpdateDecorationDto) {
    return this.decorationService.update(+id, updateDecorationDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('decoration:manage')
  @ApiOperation({ summary: '删除装饰品' })
  @ApiResponse({ status: 200, description: '删除成功' })
  remove(@Param('id') id: string) {
    return this.decorationService.remove(+id);
  }

  @Post('purchase')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: '购买装饰品' })
  @ApiResponse({ status: 200, description: '购买成功' })
  purchase(@Request() req, @Body() purchaseDto: PurchaseDecorationDto) {
    return this.decorationService.purchase(req.user.id, purchaseDto);
  }

  @Post('gift')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: '赠送装饰品' })
  @ApiResponse({ status: 200, description: '赠送成功' })
  gift(@Request() req, @Body() giftDto: GiftDecorationDto) {
    return this.decorationService.gift(req.user.id, giftDto);
  }

  @Get('user/my')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: '获取我的装饰品' })
  @ApiResponse({ status: 200, description: '获取成功' })
  getMyDecorations(@Request() req, @Query('type') type?: string) {
    return this.decorationService.getUserDecorations(req.user.id, type);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: '获取用户的装饰品' })
  @ApiResponse({ status: 200, description: '获取成功' })
  getUserDecorations(@Param('userId') userId: string, @Query('type') type?: string) {
    return this.decorationService.getUserDecorations(+userId, type);
  }

  @Post('use/:decorationId')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: '使用装饰品' })
  @ApiResponse({ status: 200, description: '装备成功' })
  useDecoration(@Request() req, @Param('decorationId') decorationId: string) {
    return this.decorationService.useDecoration(req.user.id, +decorationId);
  }

  @Post('unuse/:decorationId')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: '取消使用装饰品' })
  @ApiResponse({ status: 200, description: '取消成功' })
  unuseDecoration(@Request() req, @Param('decorationId') decorationId: string) {
    return this.decorationService.unuseDecoration(req.user.id, +decorationId);
  }

  @Get('user/current/decorations')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: '获取当前使用的装饰品' })
  @ApiResponse({ status: 200, description: '获取成功' })
  getCurrentDecorations(@Request() req) {
    return this.decorationService.getCurrentDecorations(req.user.id);
  }

  @Post('activity/claim/:activityId')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: '领取活动奖励' })
  @ApiResponse({ status: 200, description: '领取成功' })
  claimActivityReward(@Request() req, @Param('activityId') activityId: string) {
    return this.decorationService.claimActivityReward(req.user.id, +activityId);
  }

  @Get('activity/progress/my')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: '获取我的活动进度' })
  @ApiResponse({ status: 200, description: '获取成功' })
  getMyActivityProgress(@Request() req) {
    return this.decorationService.getUserActivityProgress(req.user.id);
  }

  @Post('clean-expired')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('decoration:manage')
  @ApiOperation({ summary: '清理过期装饰品' })
  @ApiResponse({ status: 200, description: '清理成功' })
  cleanExpired() {
    return this.decorationService.cleanExpiredDecorations();
  }
}
