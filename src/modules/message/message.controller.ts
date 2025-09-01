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
  ForbiddenException,
} from "@nestjs/common";
import { MessageService } from "./message.service";
import { CreateMessageDto } from "./dto/create-message.dto";
import { UpdateMessageDto } from "./dto/update-message.dto";
import { QueryMessageDto } from "./dto/query-message.dto";
import { BatchMessageDto, MarkAllReadDto } from "./dto/batch-message.dto";
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiParam,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { Permissions } from "src/common/decorators/permissions.decorator";
import { PermissionGuard } from "src/common/guards/permission.guard";
import { PaginationDto } from "src/common/dto/pagination.dto";
import { PermissionUtil } from "src/common/utils/permission.util";

@ApiTags("信息管理")
@ApiBearerAuth()
@Controller("message")
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @ApiOperation({ summary: "创建消息（支持全员、部分、个人通知）" })
  @ApiBody({ type: CreateMessageDto })
  @UseGuards(AuthGuard("jwt"), PermissionGuard)
  @Permissions("message:manage")
  @Post()
  async create(@Body() createMessageDto: CreateMessageDto, @Req() req: any) {
    return this.messageService.create(createMessageDto, req.user);
  }

  @ApiOperation({ summary: "获取当前用户所有消息（含全员通知）" })
  @UseGuards(AuthGuard("jwt"))
  @Get()
  async findAll(@Query() pagination: PaginationDto, @Req() req: any) {
    return this.messageService.findAllByUser(req.user, pagination);
  }

  @ApiOperation({ summary: "高级查询消息" })
  @ApiQuery({ name: "type", enum: ["private", "system", "notification"], required: false })
  @ApiQuery({ name: "isRead", type: Boolean, required: false })
  @ApiQuery({ name: "isBroadcast", type: Boolean, required: false })
  @ApiQuery({ name: "keyword", type: String, required: false })
  @UseGuards(AuthGuard("jwt"))
  @Get("search")
  async search(@Query() queryDto: QueryMessageDto, @Req() req: any) {
    return this.messageService.findAll(queryDto, req.user);
  }

  @ApiOperation({ summary: "获取单条消息" })
  @ApiParam({ name: "id", description: "消息ID" })
  @UseGuards(AuthGuard("jwt"))
  @Get(":id")
  async findOne(@Param("id") id: string, @Req() req: any) {
    return this.messageService.findOne(+id, req.user);
  }

  @ApiOperation({ summary: "更新消息内容" })
  @ApiParam({ name: "id", description: "消息ID" })
  @ApiBody({ type: UpdateMessageDto })
  @UseGuards(AuthGuard("jwt"), PermissionGuard)
  @Permissions("message:manage")
  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() updateMessageDto: UpdateMessageDto,
    @Req() req: any,
  ) {
    return this.messageService.update(+id, updateMessageDto, req.user);
  }

  @ApiOperation({ summary: "删除消息" })
  @ApiParam({ name: "id", description: "消息ID" })
  @UseGuards(AuthGuard("jwt"), PermissionGuard)
  @Permissions("message:delete")
  @Delete(":id")
  async remove(@Param("id") id: string, @Req() req: any) {
    return await this.messageService.remove(+id, req.user);
  }

  @ApiOperation({ summary: "标记消息为已读" })
  @ApiParam({ name: "id", description: "消息ID" })
  @UseGuards(AuthGuard("jwt"))
  @Post(":id/read")
  async markAsRead(@Param("id") id: string, @Req() req: any) {
    return await this.messageService.markAsRead(+id, req.user);
  }

  @ApiOperation({ summary: "标记所有消息为已读" })
  @ApiBody({ type: MarkAllReadDto })
  @UseGuards(AuthGuard("jwt"))
  @Post("read-all")
  async markAllAsRead(@Body() markAllReadDto: MarkAllReadDto, @Req() req: any) {
    return await this.messageService.markAllAsRead(markAllReadDto, req.user);
  }

  @ApiOperation({ summary: "批量操作消息（标记已读/删除）" })
  @ApiBody({ type: BatchMessageDto })
  @UseGuards(AuthGuard("jwt"))
  @Post("batch")
  async batchOperation(@Body() batchMessageDto: BatchMessageDto, @Req() req: any) {
    return await this.messageService.batchOperation(batchMessageDto, req.user);
  }

  @ApiOperation({ summary: "获取未读消息数量" })
  @UseGuards(AuthGuard("jwt"))
  @Get("unread/count")
  async getUnreadCount(@Req() req: any) {
    return await this.messageService.getUnreadCount(req.user);
  }

  @ApiOperation({ 
    summary: "获取消息统计信息",
    description: "返回消息的完整统计信息，包括按类型统计、未读消息统计和总体统计"
  })
  @UseGuards(AuthGuard("jwt"))
  @Get("stats")
  async getMessageStats(@Req() req: any) {
    return await this.messageService.getMessageStats(req.user);
  }
}
