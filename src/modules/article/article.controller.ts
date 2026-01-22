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
import { RecordBrowseHistoryDto } from "./dto/record-browse-history.dto";
import { QueryBrowseHistoryDto } from "./dto/query-browse-history.dto";
import { JwtAuthGuard } from "src/common/guards/jwt-auth.guard";
import { NoAuth } from "src/common/decorators/no-auth.decorator";
import { Permissions } from "src/common/decorators/permissions.decorator";
import { PermissionGuard } from "src/common/guards/permission.guard";
import { PaginationDto } from "src/common/dto/pagination.dto";
import { User } from "../user/entities/user.entity";

@Controller("article")
@ApiTags("文章管理")
@ApiBearerAuth()
export class ArticleController {
  constructor(private readonly articleService: ArticleService) { }

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
    @Query("type") type?: "all" | "popular" | "latest" | "following",
  ) {
    return this.articleService.findAllArticles(
      pagination,
      title,
      categoryId,
      req.user,
      type,
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

  @Get("/liked")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "获取用户点赞文章列表" })
  @ApiResponse({ status: 200, description: "获取成功" })
  getLikedArticles(
    @Req() req: Request & { user: User },
    @Query() pagination: PaginationDto,
  ) {
    return this.articleService.getLikedArticles(req.user, pagination);
  }
  @Get('favorited/list')
  @UseGuards(JwtAuthGuard)
  @NoAuth()
  @ApiOperation({ summary: '获取用户收藏的文章列表' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 403, description: '用户隐私设置不允许查看' })
  getFavoritedArticles(
    @Req() req: Request & { user: User },
    @Query() pagination: PaginationDto,
    @Query('userId') targetUserId?: number,
  ) {
    const currentUser = req.user;
    const userId = targetUserId || currentUser?.id;

    return this.articleService.getFavoritedArticles(userId, currentUser, pagination);
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
  remove(@Param("id") id: string, @Req() req: Request & { user: User }) {
    return this.articleService.remove(+id, req.user);
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
    @Query("categoryId") categoryId?: number,
    @Query("keyword") keyword?: string,
  ) {
    return this.articleService.findByAuthor(
      +id,
      pagination,
      req.user,
      type,
      categoryId,
      keyword,
    );
  }

  @Get("published/ids")
  @ApiOperation({ summary: "获取已发布文章ID列表" })
  @ApiResponse({ status: 200, description: "获取成功" })
  @NoAuth()
  getPublishedArticleIds() {
    return this.articleService.getPublishedArticleIds();
  }

  // ==================== 浏览历史相关接口 ====================

  @Post(':id/browse/progress')
  @ApiOperation({ summary: '更新文章浏览进度' })
  @UseGuards(JwtAuthGuard)
  updateBrowseProgress(
    @Param('id') id: string,
    @Body() recordDto: RecordBrowseHistoryDto,
    @Req() req,
  ) {
    return this.articleService.updateBrowseProgress(req.user.id, +id, recordDto);
  }

  @Get('browse/history')
  @ApiOperation({ summary: '获取用户浏览历史列表' })
  @UseGuards(JwtAuthGuard)
  getUserBrowseHistory(
    @Req() req,
    @Query() queryDto: QueryBrowseHistoryDto,
  ) {
    return this.articleService.getUserBrowseHistory(req.user.id, queryDto);
  }

  @Get('browse/stats')
  @ApiOperation({ summary: '获取浏览统计' })
  @UseGuards(JwtAuthGuard)
  getBrowseStats(@Req() req) {
    return this.articleService.getBrowseStats(req.user.id);
  }

  @Get('browse/recent')
  @ApiOperation({ summary: '获取最近浏览的文章' })
  @UseGuards(JwtAuthGuard)
  getRecentBrowsedArticles(@Req() req, @Query('limit') limit?: number) {
    return this.articleService.getRecentBrowsedArticles(
      req.user.id,
      limit ? +limit : 10,
    );
  }

  @Get('browse/:articleId')
  @ApiOperation({ summary: '获取单条浏览记录' })
  @UseGuards(JwtAuthGuard)
  getBrowseHistory(@Req() req, @Param('articleId') articleId: string) {
    return this.articleService.getBrowseHistory(req.user.id, +articleId);
  }

  @Delete('browse/:articleId')
  @ApiOperation({ summary: '删除单条浏览记录' })
  @UseGuards(JwtAuthGuard)
  deleteBrowseHistory(@Req() req, @Param('articleId') articleId: string) {
    return this.articleService.deleteBrowseHistory(req.user.id, +articleId);
  }

  @Post('browse/batch-delete')
  @ApiOperation({ summary: '批量删除浏览记录' })
  @UseGuards(JwtAuthGuard)
  batchDeleteBrowseHistory(@Req() req, @Body() body: { articleIds: number[] }) {
    return this.articleService.batchDeleteBrowseHistory(req.user.id, body.articleIds);
  }

  @Delete('browse')
  @ApiOperation({ summary: '清空浏览历史' })
  @UseGuards(JwtAuthGuard)
  clearBrowseHistory(@Req() req) {
    return this.articleService.clearBrowseHistory(req.user.id);
  }

  // ==================== 收藏相关接口 ====================

  @Post(':id/favorite')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '收藏文章（添加到默认收藏夹）' })
  @ApiResponse({ status: 200, description: '收藏成功' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 404, description: '文章不存在' })
  favoriteArticle(@Param('id') id: string, @Req() req: Request & { user: User }) {
    return this.articleService.favoriteArticle(+id, req.user.id);
  }

  @Delete(':id/favorite')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '取消收藏文章' })
  @ApiResponse({ status: 200, description: '取消收藏成功' })
  @ApiResponse({ status: 401, description: '未授权' })
  unfavoriteArticle(@Param('id') id: string, @Req() req: Request & { user: User }) {
    return this.articleService.unfavoriteArticle(+id, req.user.id);
  }

  @Get(':id/favorite/status')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '检查文章是否已收藏' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 401, description: '未授权' })
  checkFavoriteStatus(@Param('id') id: string, @Req() req: Request & { user: User }) {
    return this.articleService.checkFavoriteStatus(+id, req.user.id);
  }
}
