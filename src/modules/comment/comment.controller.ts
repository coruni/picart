import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  ParseIntPipe,
  Request,
  HttpStatus,
  HttpCode,
} from "@nestjs/common";
import { CommentService } from "./comment.service";
import { CreateCommentDto } from "./dto/create-comment.dto";
import { UpdateCommentDto } from "./dto/update-comment.dto";
import { AuthGuard } from "@nestjs/passport";
import { User } from "../user/entities/user.entity";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";
import { PaginationDto } from "src/common/dto/pagination.dto";
import { Permissions } from "src/common/decorators/permissions.decorator";
import { PermissionGuard } from "src/common/guards/permission.guard";

@ApiTags("评论管理")
@Controller("comments")
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Post()
  @UseGuards(AuthGuard("jwt"), PermissionGuard)
  @Permissions("comment:create")
  @ApiBearerAuth()
  @ApiOperation({ summary: "创建评论" })
  @ApiResponse({ status: 201, description: "评论创建成功" })
  @ApiResponse({ status: 400, description: "请求参数错误" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "权限不足" })
  @ApiResponse({ status: 404, description: "文章或父评论不存在" })
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() createCommentDto: CreateCommentDto,
    @Request() req: Request & { user: User },
  ) {
    return this.commentService.createComment(createCommentDto, req.user);
  }

  @Get("article/:id")
  @UseGuards(AuthGuard("jwt"), PermissionGuard)
  @Permissions("comment:read")
  @ApiBearerAuth()
  @ApiOperation({ summary: "获取文章评论列表" })
  @ApiParam({ name: "id", description: "文章ID", type: "number" })
  @ApiQuery({
    name: "page",
    description: "页码",
    type: "number",
    required: false,
  })
  @ApiQuery({
    name: "limit",
    description: "每页数量",
    type: "number",
    required: false,
  })
  @ApiResponse({ status: 200, description: "获取成功" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "权限不足" })
  @ApiResponse({ status: 404, description: "文章不存在" })
  findAll(
    @Param("id", ParseIntPipe) id: number,
    @Query() pagination: PaginationDto,
  ) {
    return this.commentService.findCommentsByArticle(id, pagination);
  }

  @Get(":id")
  @UseGuards(AuthGuard("jwt"), PermissionGuard)
  @Permissions("comment:read")
  @ApiBearerAuth()
  @ApiOperation({ summary: "获取评论详情" })
  @ApiParam({ name: "id", description: "评论ID", type: "number" })
  @ApiQuery({
    name: "repliesPage",
    description: "子评论页码",
    type: "number",
    required: false,
  })
  @ApiQuery({
    name: "repliesLimit",
    description: "每页子评论数量",
    type: "number",
    required: false,
  })
  @ApiResponse({ status: 200, description: "获取成功" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "权限不足" })
  @ApiResponse({ status: 404, description: "评论不存在" })
  findOne(
    @Param("id", ParseIntPipe) id: number,
    @Query("repliesPage") repliesPage: number = 1,
    @Query("repliesLimit") repliesLimit: number = 10,
  ) {
    return this.commentService.findCommentDetail(
      id,
      Number(repliesPage),
      Number(repliesLimit),
    );
  }

  @Patch(":id")
  @UseGuards(AuthGuard("jwt"), PermissionGuard)
  @Permissions("comment:update")
  @ApiBearerAuth()
  @ApiOperation({ summary: "更新评论" })
  @ApiParam({ name: "id", description: "评论ID", type: "number" })
  @ApiResponse({ status: 200, description: "更新成功" })
  @ApiResponse({ status: 400, description: "请求参数错误" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "权限不足" })
  @ApiResponse({ status: 404, description: "评论不存在" })
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateCommentDto: UpdateCommentDto,
    @Request() req: Request & { user: User },
  ) {
    return this.commentService.updateComment(id, updateCommentDto, req.user);
  }

  @Delete(":id")
  @UseGuards(AuthGuard("jwt"), PermissionGuard)
  @Permissions("comment:delete")
  @ApiBearerAuth()
  @ApiOperation({ summary: "删除评论" })
  @ApiParam({ name: "id", description: "评论ID", type: "number" })
  @ApiResponse({ status: 200, description: "删除成功" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "权限不足" })
  @ApiResponse({ status: 404, description: "评论不存在" })
  remove(
    @Param("id", ParseIntPipe) id: number,
    @Request() req: Request & { user: User },
  ) {
    return this.commentService.removeComment(id, req.user);
  }

  @Post(":id/like")
  @UseGuards(AuthGuard("jwt"))
  @ApiBearerAuth()
  @ApiOperation({ summary: "点赞评论" })
  @ApiParam({ name: "id", description: "评论ID", type: "number" })
  @ApiResponse({ status: 200, description: "点赞成功" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 404, description: "评论不存在" })
  like(
    @Param("id", ParseIntPipe) id: number,
    @Request() req: Request & { user: User },
  ) {
    return this.commentService.like(id, req.user);
  }

  @Get(":id/replies")
  @ApiOperation({ summary: "获取评论回复列表" })
  @ApiParam({ name: "id", description: "父评论ID", type: "number" })
  @ApiQuery({
    name: "page",
    description: "页码",
    type: "number",
    required: false,
  })
  @ApiQuery({
    name: "limit",
    description: "每页数量",
    type: "number",
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: "获取成功",
  })
  @ApiResponse({ status: 404, description: "父评论不存在" })
  getReplies(
    @Param("id", ParseIntPipe) id: number,
    @Query() pagination: PaginationDto,
  ) {
    return this.commentService.getReplies(id, pagination);
  }

  @Get("user/:userId")
  @ApiOperation({ summary: "获取用户评论列表" })
  @ApiParam({ name: "userId", description: "用户ID", type: "number" })
  @ApiQuery({
    name: "page",
    description: "页码",
    type: "number",
    required: false,
  })
  @ApiQuery({
    name: "limit",
    description: "每页数量",
    type: "number",
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: "获取成功",
  })
  getUserComments(
    @Param("userId", ParseIntPipe) userId: number,
    @Query() pagination: PaginationDto,
  ) {
    return this.commentService.getUserComments(userId, pagination);
  }

  @Get("article/:id/count")
  @ApiOperation({ summary: "获取文章评论数量" })
  @ApiParam({ name: "id", description: "文章ID", type: "number" })
  @ApiResponse({ status: 200, description: "获取成功" })
  getCommentCount(@Param("id", ParseIntPipe) id: number) {
    return this.commentService.getCommentCount(id);
  }
}
