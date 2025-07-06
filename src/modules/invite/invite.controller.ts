import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { InviteService } from './invite.service';
import { CreateInviteDto } from './dto/create-invite.dto';
import { UseInviteDto } from './dto/use-invite.dto';
import { PaginationDto } from 'src/common/dto/pagination.dto';

@Controller('invite')
@ApiTags('邀请管理')
@ApiBearerAuth()
export class InviteController {
  constructor(private readonly inviteService: InviteService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: '创建邀请码' })
  @ApiResponse({ status: 201, description: '邀请码创建成功' })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 401, description: '未授权' })
  async createInvite(@Request() req, @Body() createInviteDto: CreateInviteDto) {
    return await this.inviteService.createInvite(req.user.id, createInviteDto);
  }

  @Post('use')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: '使用邀请码' })
  @ApiResponse({ status: 200, description: '邀请码使用成功' })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 404, description: '邀请码不存在' })
  @ApiResponse({ status: 409, description: '邀请码已使用' })
  async useInvite(@Request() req, @Body() useInviteDto: UseInviteDto) {
    return await this.inviteService.useInvite(req.user.id, useInviteDto);
  }

  @Get('my')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: '获取我的邀请列表' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 401, description: '未授权' })
  async getMyInvites(@Request() req, @Query() pagination: PaginationDto) {
    return await this.inviteService.getMyInvites(req.user.id, pagination);
  }

  @Get('stats')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: '获取邀请统计信息' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 401, description: '未授权' })
  async getInviteStats(@Request() req) {
    return await this.inviteService.getInviteStats(req.user.id);
  }

  @Get('earnings')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: '获取邀请收益记录' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 401, description: '未授权' })
  async getMyInviteEarnings(@Request() req, @Query() pagination: PaginationDto) {
    return await this.inviteService.getMyInviteEarnings(req.user.id, pagination);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: '获取邀请详情' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 404, description: '邀请记录不存在' })
  async getInviteDetail(@Request() req, @Param('id') id: string) {
    return await this.inviteService.getInviteDetail(req.user.id, +id);
  }
} 