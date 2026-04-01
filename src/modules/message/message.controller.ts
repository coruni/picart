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
import { User } from "../user/entities/user.entity";
import { JwtAuthGuard } from "src/common/guards/jwt-auth.guard";
import { PrivateMessageService } from "./private-message.service";
import {
  BatchReadPrivateMessagesDto,
  CursorPaginationDto,
  RecallPrivateMessageDto,
  SendPrivateMessageDto,
} from "./dto/private-message.dto";

@ApiTags("信息管理")
@ApiBearerAuth()
@Controller("message")
export class MessageController {
  constructor(
    private readonly messageService: MessageService,
    private readonly privateMessageService: PrivateMessageService,
  ) {}

  @ApiOperation({ summary: "创建消息（支持全员、部分、个人通知）" })
  @ApiBody({ type: CreateMessageDto })
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions("message:manage")
  @Post()
  async create(@Body() createMessageDto: CreateMessageDto, @Req() req: Request & { user: User }) {
    return this.messageService.create(createMessageDto, req.user);
  }

  @ApiOperation({ summary: "获取当前用户所有消息（含全员通知）" })
  @UseGuards(AuthGuard("jwt"))
  @Get()
  async findAll(@Query() pagination: PaginationDto, @Req() req: Request & { user: User }) {
    return this.messageService.findAllByUser(req.user, pagination);
  }

  @ApiOperation({ summary: "获取当前用户的私信会话列表" })
  @UseGuards(AuthGuard("jwt"))
  @Get("private/conversations")
  async getPrivateConversations(
    @Query() pagination: CursorPaginationDto,
    @Req() req: Request & { user: User },
  ) {
    return this.privateMessageService.getPrivateConversations(
      req.user,
      pagination,
    );
  }

  @ApiOperation({ summary: "获取与指定用户的私信记录" })
  @ApiParam({ name: "userId", description: "会话对方用户ID" })
  @UseGuards(AuthGuard("jwt"))
  @Get("private/conversations/:userId/messages")
  async getPrivateConversation(
    @Param("userId") userId: string,
    @Query() pagination: CursorPaginationDto,
    @Req() req: Request & { user: User },
  ) {
    return this.privateMessageService.getPrivateConversationMessages(
      req.user,
      +userId,
      pagination,
    );
  }

  @ApiOperation({ summary: "发送私信" })
  @ApiParam({ name: "userId", description: "接收者用户ID" })
  @ApiBody({
    type: SendPrivateMessageDto,
  })
  @UseGuards(AuthGuard("jwt"))
  @Post("private/:userId")
  async sendPrivateMessage(
    @Param("userId") userId: string,
    @Body() body: SendPrivateMessageDto,
    @Req() req: Request & { user: User },
  ) {
    return this.privateMessageService.sendPrivateMessage(
      req.user,
      +userId,
      body,
    );
  }

  @ApiOperation({ summary: "批量标记私信已读" })
  @ApiBody({ type: BatchReadPrivateMessagesDto })
  @UseGuards(AuthGuard("jwt"))
  @Post("private/read-batch")
  async markPrivateMessagesRead(
    @Body() body: BatchReadPrivateMessagesDto,
    @Req() req: Request & { user: User },
  ) {
    return this.privateMessageService.markMessagesAsRead(req.user, body);
  }

  @ApiOperation({ summary: "撤回私信" })
  @ApiParam({ name: "id", description: "私信ID" })
  @ApiBody({ type: RecallPrivateMessageDto })
  @UseGuards(AuthGuard("jwt"))
  @Post("private/recall/:id")
  async recallPrivateMessage(
    @Param("id") id: string,
    @Body() body: RecallPrivateMessageDto,
    @Req() req: Request & { user: User },
  ) {
    return this.privateMessageService.recallMessage(req.user, +id, body.reason);
  }

  @ApiOperation({ summary: "拉黑私信对象" })
  @ApiParam({ name: "userId", description: "目标用户ID" })
  @UseGuards(AuthGuard("jwt"))
  @Post("private/block/:userId")
  async blockPrivateUser(
    @Param("userId") userId: string,
    @Req() req: Request & { user: User },
  ) {
    return this.privateMessageService.blockUser(req.user, +userId);
  }

  @ApiOperation({ summary: "取消拉黑私信对象" })
  @ApiParam({ name: "userId", description: "目标用户ID" })
  @UseGuards(AuthGuard("jwt"))
  @Delete("private/block/:userId")
  async unblockPrivateUser(
    @Param("userId") userId: string,
    @Req() req: Request & { user: User },
  ) {
    return this.privateMessageService.unblockUser(req.user, +userId);
  }

  @ApiOperation({ summary: "获取拉黑列表" })
  @UseGuards(AuthGuard("jwt"))
  @Get("private/blocks")
  async getBlockedUsers(@Req() req: Request & { user: User }) {
    return this.privateMessageService.getBlockedUsers(req.user);
  }

  @ApiOperation({ summary: "高级查询消息" })
  @ApiQuery({ name: "type", enum: ["private", "system", "notification"], required: false })
  @ApiQuery({ name: "isRead", type: Boolean, required: false })
  @ApiQuery({ name: "isBroadcast", type: Boolean, required: false })
  @ApiQuery({ name: "keyword", type: String, required: false })
  @UseGuards(AuthGuard("jwt"))
  @Get("search")
  async search(@Query() queryDto: QueryMessageDto, @Req() req: Request & { user: User }) {
    return this.messageService.findAll(queryDto, req.user);
  }

  @ApiOperation({ summary: "获取单条消息" })
  @ApiParam({ name: "id", description: "消息ID" })
  @UseGuards(AuthGuard("jwt"))
  @Get(":id")
  async findOne(@Param("id") id: string, @Req() req: Request & { user: User }) {
    return this.messageService.findOne(+id, req.user);
  }

  @ApiOperation({ summary: "更新消息内容" })
  @ApiParam({ name: "id", description: "消息ID" })
  @ApiBody({ type: UpdateMessageDto })
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions("message:manage")
  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() updateMessageDto: UpdateMessageDto,
    @Req() req: Request & { user: User },
  ) {
    return this.messageService.update(+id, updateMessageDto, req.user);
  }

  @ApiOperation({ summary: "删除消息" })
  @ApiParam({ name: "id", description: "消息ID" })
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions("message:delete")
  @Delete(":id")
  async remove(@Param("id") id: string, @Req() req: Request & { user: User }) {
    return await this.messageService.remove(+id, req.user);
  }

  @ApiOperation({ summary: "标记消息为已读" })
  @ApiParam({ name: "id", description: "消息ID" })
  @UseGuards(AuthGuard("jwt"))
  @Post(":id/read")
  async markAsRead(@Param("id") id: string, @Req() req: Request & { user: User }) {
    return await this.messageService.markAsRead(+id, req.user);
  }

  @ApiOperation({ summary: "标记所有消息为已读" })
  @ApiBody({ type: MarkAllReadDto })
  @UseGuards(AuthGuard("jwt"))
  @Post("read-all")
  async markAllAsRead(@Body() markAllReadDto: MarkAllReadDto, @Req() req: Request & { user: User }) {
    return await this.messageService.markAllAsRead(markAllReadDto, req.user);
  }

  @ApiOperation({ summary: "批量操作消息（标记已读/删除）" })
  @ApiBody({ type: BatchMessageDto })
  @UseGuards(AuthGuard("jwt"))
  @Post("batch")
  async batchOperation(@Body() batchMessageDto: BatchMessageDto, @Req() req: Request & { user: User }) {
    return await this.messageService.batchOperation(batchMessageDto, req.user);
  }

  @ApiOperation({ summary: "获取未读消息数量" })
  @UseGuards(AuthGuard("jwt"))
  @Get("unread/count")
  async getUnreadCount(@Req() req: Request & { user: User }) {
    return await this.messageService.getUnreadCount(req.user);
  }
}
