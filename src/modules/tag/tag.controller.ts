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
import { TagService } from "./tag.service";
import { CreateTagDto } from "./dto/create-tag.dto";
import { UpdateTagDto } from "./dto/update-tag.dto";
import { AuthGuard } from "@nestjs/passport";
import { Permissions } from "src/common/decorators/permissions.decorator";
import { PermissionGuard } from "src/common/guards/permission.guard";
import { PaginationDto } from "src/common/dto/pagination.dto";
import { User } from "../user/entities/user.entity";
import { NoAuth } from "src/common/decorators/no-auth.decorator";
import { JwtAuthGuard } from "src/common/guards/jwt-auth.guard";

@Controller("tag")
@ApiTags("标签管理")
@ApiBearerAuth()
export class TagController {
  constructor(private readonly tagService: TagService) {}

  @Post()
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions("tag:create")
  @ApiOperation({ summary: "创建标签" })
  @ApiResponse({ status: 201, description: "创建成功" })
  @ApiResponse({ status: 400, description: "请求参数错误" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "权限不足" })
  create(@Body() createTagDto: CreateTagDto) {
    return this.tagService.create(createTagDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @NoAuth()
  @ApiOperation({ summary: "获取所有标签" })
  @ApiResponse({ status: 200, description: "获取成功" })
  findAll(
    @Query() pagination: PaginationDto,
    @Query("name") name: string,
    @Req() req: Request & { user: User },
    @Query("sortBy") sortBy?: string,
    @Query("sortOrder") sortOrder?: "ASC" | "DESC",
  ) {
    return this.tagService.findAll(
      pagination,
      name,
      sortBy,
      sortOrder,
      req.user,
    );
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard)
  @NoAuth()
  @ApiOperation({ summary: "获取标签详情" })
  @ApiResponse({ status: 200, description: "获取成功" })
  @ApiResponse({ status: 404, description: "标签不存在" })
  findOne(@Param("id") id: string, @Req() req: Request & { user: User }) {
    return this.tagService.findOne(+id, req.user);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions("tag:update")
  @ApiOperation({ summary: "更新标签" })
  @ApiResponse({ status: 200, description: "更新成功" })
  @ApiResponse({ status: 400, description: "请求参数错误" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "权限不足" })
  @ApiResponse({ status: 404, description: "标签不存在" })
  update(@Param("id") id: string, @Body() updateTagDto: UpdateTagDto) {
    return this.tagService.update(+id, updateTagDto);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions("tag:delete")
  @ApiOperation({ summary: "删除标签" })
  @ApiResponse({ status: 200, description: "删除成功" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "权限不足" })
  @ApiResponse({ status: 404, description: "标签不存在" })
  remove(@Param("id") id: string) {
    return this.tagService.remove(+id);
  }

  @Post(":id/follow")
  @UseGuards(AuthGuard("jwt"))
  @ApiOperation({ summary: "关注标签" })
  @ApiResponse({ status: 200, description: "关注成功" })
  @ApiResponse({ status: 400, description: "已关注该标签" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 404, description: "标签不存在" })
  follow(@Param("id") id: string, @Req() req: Request & { user: User }) {
    return this.tagService.followTag(+id, req.user.id);
  }

  @Delete(":id/follow")
  @UseGuards(AuthGuard("jwt"))
  @ApiOperation({ summary: "取消关注标签" })
  @ApiResponse({ status: 200, description: "取消关注成功" })
  @ApiResponse({ status: 400, description: "未关注该标签" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 404, description: "标签不存在" })
  unfollow(@Param("id") id: string, @Req() req: Request & { user: User }) {
    return this.tagService.unfollowTag(+id, req.user.id);
  }
}
