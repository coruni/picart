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
  Request,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { ArticleService } from "./article.service";
import { CreateArticleDto } from "./dto/create-article.dto";
import { UpdateArticleDto } from "./dto/update-article.dto";
import { ArticleLikeDto } from "./dto/article-reaction.dto";
import { JwtAuthGuard } from "src/common/guards/jwt-auth.guard";
import { NoAuth } from "src/common/decorators/no-auth.decorator";
import { Permissions } from "src/common/decorators/permissions.decorator";
import { PermissionGuard } from "src/common/guards/permission.guard";
import { PaginationDto } from "src/common/dto/pagination.dto";
import { User } from "../user/entities/user.entity";
import { query } from "winston";

@Controller("article")
@ApiTags("文章管理")
@ApiBearerAuth()
export class ArticleController {
  constructor(private readonly articleService: ArticleService) {}

  @Post()
  @ApiOperation({ summary: "创建文章" })
  @ApiResponse({ status: 201, description: "创建成功" })
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions("article:create")
  create(@Body() createArticleDto: CreateArticleDto, @Req() req) {
    return this.articleService.createArticle(createArticleDto, req.user);
  }

  @Get()
  @ApiOperation({ summary: "获取文章列表" })
  @ApiResponse({ status: 200, description: "获取成功" })
  @UseGuards(JwtAuthGuard)
  @NoAuth()
  findAll(
    @Query() pagination: PaginationDto,
    @Req() req: Request & { user: User },
    @Query("title") title?: string,
    @Query("categoryId") categoryId?: number,
  ) {
    return this.articleService.findAllArticles(
      pagination,
      title,
      categoryId,
      req.user,
    );
  }

  @Get("recommend/:id")
  @UseGuards(JwtAuthGuard)
  @NoAuth()
  @ApiOperation({ summary: "获取相关文章" })
  @ApiResponse({ status: 200, description: "获取成功" })
  findRecommendations(@Param("id") id: string) {
    return this.articleService.findRelatedRecommendations(+id);
  }

  @Get("search")
  @ApiOperation({ summary: "搜索文章" })
  @ApiResponse({ status: 200, description: "获取成功" })
  @ApiResponse({ status: 400, description: "请求参数错误" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 404, description: "文章不存在" })
  @UseGuards(JwtAuthGuard)
  @NoAuth()
  search(
    @Query("keyword") keyword: string,
    @Query() pagination: PaginationDto,
    @Req() req: Request & { user?: User },
    @Query("categoryId") categoryId?: number,
  ) {
    return this.articleService.searchArticles(
      keyword,
      pagination,
      categoryId,
      req.user,
    );
  }

  @Get(":id")
  @ApiOperation({ summary: "获取文章详情" })
  @ApiResponse({ status: 200, description: "获取成功" })
  @ApiResponse({ status: 404, description: "文章不存在" })
  @UseGuards(JwtAuthGuard)
  @NoAuth()
  findOne(@Param("id") id: string, @Req() req: Request & { user: User }) {
    return this.articleService.findOne(+id, req.user);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions("article:update")
  @ApiOperation({ summary: "更新文章" })
  @ApiResponse({ status: 200, description: "更新成功" })
  @ApiResponse({ status: 400, description: "请求参数错误" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "权限不足" })
  @ApiResponse({ status: 404, description: "文章不存在" })
  update(
    @Param("id") id: string,
    @Body() updateArticleDto: UpdateArticleDto,
    @Req() req: Request & { user: User },
  ) {
    return this.articleService.update(+id, updateArticleDto, req.user);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions("article:delete")
  @ApiOperation({ summary: "删除文章" })
  @ApiResponse({ status: 200, description: "删除成功" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "权限不足" })
  @ApiResponse({ status: 404, description: "文章不存在" })
  remove(@Param("id") id: string) {
    return this.articleService.remove(+id);
  }

  @Post(":id/like")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "点赞/表情回复文章" })
  @ApiResponse({ status: 200, description: "操作成功" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 404, description: "文章不存在" })
  like(
    @Param("id") id: string,
    @Body() likeDto: ArticleLikeDto,
    @Req() req: Request & { user: User },
  ) {
    return this.articleService.like(+id, req.user, likeDto);
  }

  @Get(":id/like/status")
  @UseGuards(JwtAuthGuard)
  @NoAuth()
  @ApiOperation({ summary: "获取文章点赞状态" })
  @ApiResponse({ status: 200, description: "获取成功" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 404, description: "文章不存在" })
  getLikeStatus(@Param("id") id: string, @Req() req: Request & { user: User }) {
    return this.articleService.getLikeStatus(+id, req.user?.id);
  }

  @Get(":id/like/count")
  @ApiOperation({ summary: "获取文章点赞数量" })
  @ApiResponse({ status: 200, description: "获取成功" })
  @ApiResponse({ status: 404, description: "文章不存在" })
  getLikeCount(@Param("id") id: string) {
    return this.articleService.getLikeCount(+id);
  }

  @Get("author/:id")
  @ApiOperation({ summary: "根据作者获取文章列表" })
  @ApiResponse({ status: 200, description: "获取成功" })
  @UseGuards(JwtAuthGuard)
  @NoAuth()
  findByAuthor(
    @Param("id") id: string,
    @Query() pagination: PaginationDto,
    @Req() req: Request & { user: User },
    @Query("type") type?: "all" | "popular" | "latest",
  ) {
    return this.articleService.findByAuthor(+id, pagination, req.user, type);
  }
}
