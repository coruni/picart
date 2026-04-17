import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  ParseIntPipe,
  Inject,
  forwardRef,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiQuery,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionGuard } from "../../common/guards/permission.guard";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { ContentAuditService } from "./content-audit.service";
import { ReviewArticleDto } from "./dto/review-article.dto";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Article } from "../article/entities/article.entity";
import { Category } from "../category/entities/category.entity";
import { UserService } from "../user/user.service";

@ApiTags("内容审核")
@Controller("content-audit")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ContentAuditController {
  constructor(
    private contentAuditService: ContentAuditService,
    @InjectRepository(Article)
    private articleRepository: Repository<Article>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    @Inject(forwardRef(() => UserService))
    private userService: UserService,
  ) {}

  @Get("config")
  @Permissions("audit:read")
  @ApiOperation({ summary: "获取审核配置" })
  @ApiResponse({ status: 200, description: "获取成功" })
  async getConfig() {
    return {
      success: true,
      data: this.contentAuditService.getConfig(),
    };
  }

  @Post("config/reload")
  @Permissions("audit:update")
  @ApiOperation({ summary: "重新加载审核配置" })
  @ApiResponse({ status: 200, description: "重载成功" })
  async reloadConfig() {
    await this.contentAuditService.reloadConfig();
    return {
      success: true,
      message: "配置已重新加载",
    };
  }

  @Get("pending-articles")
  @Permissions("audit:read")
  @ApiOperation({ summary: "获取待审核文章列表" })
  @ApiQuery({ name: "page", description: "页码", required: false })
  @ApiQuery({ name: "limit", description: "每页数量", required: false })
  @ApiResponse({ status: 200, description: "获取成功" })
  async getPendingArticles(
    @Query("page", ParseIntPipe) page: number = 1,
    @Query("limit", ParseIntPipe) limit: number = 20,
  ) {
    const [articles, total] = await this.articleRepository.findAndCount({
      where: { status: "PENDING" },
      relations: ["author", "category"],
      order: { createdAt: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      success: true,
      data: {
        list: articles,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    };
  }

  @Post("articles/:id/review")
  @Permissions("audit:update")
  @ApiOperation({ summary: "审核文章" })
  @ApiResponse({ status: 200, description: "审核成功" })
  @ApiResponse({ status: 404, description: "文章不存在" })
  async reviewArticle(
    @Param("id", ParseIntPipe) id: number,
    @Body() reviewDto: ReviewArticleDto,
    @Req() req: any,
  ) {
    const article = await this.articleRepository.findOne({
      where: { id },
      relations: ["author", "category"],
    });

    if (!article) {
      return {
        success: false,
        message: "文章不存在",
      };
    }

    if (article.status !== "PENDING") {
      return {
        success: false,
        message: "该文章不处于待审核状态",
      };
    }

    if (reviewDto.result === "APPROVED") {
      article.status = "PUBLISHED";
      await this.articleRepository.save(article);

      // 更新统计
      await this.userService.incrementArticleCount(article.author.id);
      await this.categoryRepository.increment(
        { id: article.category.id },
        "articleCount",
        1,
      );
    } else {
      article.status = "REJECTED";
      await this.articleRepository.save(article);
    }

    return {
      success: true,
      message: reviewDto.result === "APPROVED" ? "文章已通过审核" : "文章已拒绝",
      data: {
        articleId: id,
        result: reviewDto.result,
        reason: reviewDto.reason,
        reviewedBy: req.user?.id,
        reviewedAt: new Date(),
      },
    };
  }

  @Post("text")
  @Permissions("audit:read")
  @ApiOperation({ summary: "测试文本审核" })
  @ApiResponse({ status: 200, description: "审核完成" })
  async auditText(@Body("content") content: string) {
    const result = await this.contentAuditService.auditText({ content });
    return {
      success: true,
      data: result,
    };
  }

  @Post("image")
  @Permissions("audit:read")
  @ApiOperation({ summary: "测试图片审核" })
  @ApiResponse({ status: 200, description: "审核完成" })
  async auditImage(@Body("url") url: string) {
    const result = await this.contentAuditService.auditImage({ url });
    return {
      success: true,
      data: result,
    };
  }
}
