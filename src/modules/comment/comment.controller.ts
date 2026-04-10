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
  Req,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { CommentService } from "./comment.service";
import { CreateCommentDto } from "./dto/create-comment.dto";
import { UpdateCommentDto } from "./dto/update-comment.dto";
import { JwtAuthGuard } from "src/common/guards/jwt-auth.guard";
import { NoAuth } from "src/common/decorators/no-auth.decorator";
import { Permissions } from "src/common/decorators/permissions.decorator";
import { PermissionGuard } from "src/common/guards/permission.guard";
import { PaginationDto } from "src/common/dto/pagination.dto";
import { User } from "../user/entities/user.entity";
import { QueryArticleCommentsDto } from "./dto/query-article-comments.dto";
import { SetCommentPinDto } from "./dto/set-comment-pin.dto";

@Controller("comment")
@ApiTags("评论管理")
@ApiBearerAuth()
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Post()
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions("comment:create")
  @ApiOperation({ summary: "创建评论" })
  @ApiResponse({ status: 201, description: "创建成功" })
  @ApiResponse({ status: 400, description: "请求参数错误" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "权限不足" })
  create(
    @Body() createCommentDto: CreateCommentDto,
    @Req() req: Request & { user: User },
  ) {
    return this.commentService.createComment(createCommentDto, req.user);
  }

  @Get()
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions("comment:manage")
  @ApiOperation({ summary: "获取全部评论" })
  @ApiResponse({ status: 200, description: "获取成功" })
  findAllComments(
    @Query() pagination: PaginationDto,
    @Query("articleId") articleId?: string,
    @Query("userId") userId?: string,
    @Query("keyword") keyword?: string,
  ) {
    return this.commentService.findAllComments(
      pagination,
      articleId ? +articleId : undefined,
      userId ? +userId : undefined,
      keyword,
    );
  }

  @Get("article/:id")
  @UseGuards(JwtAuthGuard)
  @NoAuth()
  @ApiOperation({ summary: "获取文章评论列表" })
  @ApiResponse({ status: 200, description: "获取成功" })
  findAll(
    @Param("id") id: string,
    @Query() query: QueryArticleCommentsDto,
    @Req() req: Request & { user?: User },
  ) {
    return this.commentService.findCommentsByArticle(+id, query, req.user);
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard)
  @NoAuth()
  @ApiOperation({ summary: "获取评论详情" })
  @ApiResponse({ status: 200, description: "获取成功" })
  @ApiResponse({ status: 404, description: "评论不存在" })
  findOne(
    @Param("id") id: string,
    @Query() query: QueryArticleCommentsDto,
    @Req() req: Request & { user?: User },
  ) {
    return this.commentService.findCommentDetail(+id, query, req.user);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions("comment:update")
  @ApiOperation({ summary: "更新评论" })
  @ApiResponse({ status: 200, description: "更新成功" })
  @ApiResponse({ status: 400, description: "请求参数错误" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "权限不足" })
  @ApiResponse({ status: 404, description: "评论不存在" })
  update(
    @Param("id") id: string,
    @Body() updateCommentDto: UpdateCommentDto,
    @Req() req: Request & { user: User },
  ) {
    return this.commentService.updateComment(+id, updateCommentDto, req.user);
  }

  @Patch(":id/pin")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "设置评论置顶状态" })
  setPin(
    @Param("id") id: string,
    @Body() body: SetCommentPinDto,
    @Req() req: Request & { user: User },
  ) {
    return this.commentService.setCommentPin(+id, body.isPinned, req.user);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions("comment:delete")
  @ApiOperation({ summary: "删除评论" })
  @ApiResponse({ status: 200, description: "删除成功" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "权限不足" })
  @ApiResponse({ status: 404, description: "评论不存在" })
  remove(@Param("id") id: string, @Req() req: Request & { user: User }) {
    return this.commentService.removeComment(+id, req.user);
  }

  @Post(":id/like")
  @UseGuards(JwtAuthGuard)
  @NoAuth()
  @ApiOperation({ summary: "点赞评论" })
  @ApiResponse({ status: 200, description: "点赞成功" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 404, description: "评论不存在" })
  like(@Param("id") id: string, @Req() req: Request & { user: User }) {
    return this.commentService.like(+id, req.user);
  }

  @Get("user/:userId")
  @UseGuards(JwtAuthGuard)
  @NoAuth()
  @ApiOperation({ summary: "获取用户评论列表" })
  @ApiResponse({ status: 200, description: "获取成功" })
  getUserComments(
    @Param("userId") userId: string,
    @Query() pagination: PaginationDto,
    @Req() req: Request & { user?: User },
  ) {
    return this.commentService.getUserComments(+userId, pagination, req.user);
  }

  @Get("article/:id/count")
  @UseGuards(JwtAuthGuard)
  @NoAuth()
  @ApiOperation({ summary: "获取文章评论数量" })
  @ApiResponse({ status: 200, description: "获取成功" })
  getCommentCount(@Param("id") id: string) {
    return this.commentService.getCommentCount(+id);
  }
}
