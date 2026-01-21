import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AchievementService } from './achievement.service';
import { CreateAchievementDto } from './dto/create-achievement.dto';
import { UpdateAchievementDto } from './dto/update-achievement.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { PermissionGuard } from 'src/common/guards/permission.guard';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { NoAuth } from 'src/common/decorators/no-auth.decorator';
import { User } from '../user/entities/user.entity';

@Controller('achievement')
@ApiTags('成就管理')
@ApiBearerAuth()
export class AchievementController {
  constructor(private readonly achievementService: AchievementService) {}

  @Post()
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('achievement:manage')
  @ApiOperation({ summary: '创建成就（管理员）' })
  @ApiResponse({ status: 201, description: '创建成功' })
  create(@Body() createAchievementDto: CreateAchievementDto) {
    return this.achievementService.create(createAchievementDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @NoAuth()
  @ApiOperation({ summary: '获取成就列表' })
  @ApiResponse({ status: 200, description: '获取成功' })
  findAll(@Req() req: Request & { user?: User }) {
    return this.achievementService.findAll(req.user);
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '获取用户成就统计' })
  @ApiResponse({ status: 200, description: '获取成功' })
  getUserStats(@Req() req: Request & { user: User }) {
    return this.achievementService.getUserStats(req.user.id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @NoAuth()
  @ApiOperation({ summary: '获取成就详情' })
  @ApiResponse({ status: 200, description: '获取成功' })
  findOne(
    @Param('id') id: string,
    @Req() req: Request & { user?: User },
  ) {
    return this.achievementService.findOne(+id, req.user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('achievement:manage')
  @ApiOperation({ summary: '更新成就（管理员）' })
  @ApiResponse({ status: 200, description: '更新成功' })
  update(
    @Param('id') id: string,
    @Body() updateAchievementDto: UpdateAchievementDto,
  ) {
    return this.achievementService.update(+id, updateAchievementDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('achievement:manage')
  @ApiOperation({ summary: '删除成就（管理员）' })
  @ApiResponse({ status: 200, description: '删除成功' })
  remove(@Param('id') id: string) {
    return this.achievementService.remove(+id);
  }

  @Post(':id/claim')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '领取成就奖励' })
  @ApiResponse({ status: 200, description: '领取成功' })
  claimReward(
    @Param('id') id: string,
    @Req() req: Request & { user: User },
  ) {
    return this.achievementService.claimReward(req.user.id, +id);
  }

  @Post('claim-all')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '一键领取所有成就奖励' })
  @ApiResponse({ status: 200, description: '领取成功' })
  claimAllRewards(@Req() req: Request & { user: User }) {
    return this.achievementService.claimAllRewards(req.user.id);
  }
}
