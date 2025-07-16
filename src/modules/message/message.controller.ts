import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Patch,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { MessageService } from './message.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { ApiTags, ApiOperation, ApiBody, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { PermissionGuard } from 'src/common/guards/permission.guard';
import { PaginationDto } from 'src/common/dto/pagination.dto';

@ApiTags('信息管理')
@ApiBearerAuth()
@Controller('message')
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @ApiOperation({ summary: '创建消息（支持全员、部分、个人通知）' })
  @ApiBody({ type: CreateMessageDto })
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('message:create')
  @Post()
  async create(@Body() createMessageDto: CreateMessageDto, @Req() req: any) {
    return this.messageService.create(createMessageDto, req.user);
  }

  @ApiOperation({ summary: '获取当前用户所有消息（含全员通知）' })
  @UseGuards(AuthGuard('jwt'))
  @Get()
  async findAll(@Query() pagination: PaginationDto, @Req() req: any) {
    return this.messageService.findAllByUser(req.user, pagination);
  }

  @ApiOperation({ summary: '获取单条消息' })
  @ApiParam({ name: 'id', description: '消息ID' })
  @UseGuards(AuthGuard('jwt'))
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.messageService.findOne(+id);
  }

  @ApiOperation({ summary: '更新消息内容' })
  @ApiParam({ name: 'id', description: '消息ID' })
  @ApiBody({ type: UpdateMessageDto })
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('message:update')
  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateMessageDto: UpdateMessageDto) {
    return this.messageService.update(+id, updateMessageDto);
  }

  @ApiOperation({ summary: '删除消息' })
  @ApiParam({ name: 'id', description: '消息ID' })
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('message:delete')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.messageService.remove(+id);
    return { success: true };
  }

  @ApiOperation({ summary: '标记消息为已读' })
  @ApiParam({ name: 'id', description: '消息ID' })
  @UseGuards(AuthGuard('jwt'))
  @Post(':id/read')
  async markAsRead(@Param('id') id: string, @Req() req: any) {
    await this.messageService.markAsRead(+id, req.user);
  }
}
