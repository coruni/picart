import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "./config.service";
import { CreateConfigDto } from "./dto/create-config.dto";
import { PaginationDto } from "src/common/dto/pagination.dto";
import { AuthGuard } from "@nestjs/passport";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from "@nestjs/swagger";
import { Permissions } from "src/common/decorators/permissions.decorator";
import { PermissionGuard } from "src/common/guards/permission.guard";
import { NoAuth } from "src/common/decorators/no-auth.decorator";

@ApiTags("系统配置")
@Controller("config")
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  @Post()
  @UseGuards(AuthGuard("jwt"), PermissionGuard)
  @Permissions("setting:create")
  @ApiBearerAuth()
  @ApiOperation({ summary: "创建配置" })
  @ApiResponse({ status: 201, description: "创建成功" })
  @ApiResponse({ status: 400, description: "请求参数错误" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "权限不足" })
  create(@Body() createConfigDto: CreateConfigDto) {
    return this.configService.create(createConfigDto);
  }

  @Get()
  @UseGuards(AuthGuard("jwt"), PermissionGuard)
  @Permissions("setting:read")
  @ApiBearerAuth()
  @ApiOperation({ summary: "获取所有配置" })
  @ApiResponse({ status: 200, description: "获取成功" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "权限不足" })
  findAll() {
    return this.configService.findAll();
  }

  @Get("group/:group")
  @UseGuards(AuthGuard("jwt"), PermissionGuard)
  @Permissions("setting:read")
  @ApiBearerAuth()
  @ApiOperation({ summary: "根据分组获取配置" })
  @ApiParam({ name: "group", description: "配置分组", type: "string" })
  @ApiResponse({ status: 200, description: "获取成功" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "权限不足" })
  findByGroup(@Param("group") group: string) {
    return this.configService.findByGroup(group);
  }

  @Patch()
  @UseGuards(AuthGuard("jwt"), PermissionGuard)
  @Permissions("setting:update")
  @ApiBearerAuth()
  @ApiOperation({ summary: "更新所有配置" })
  @ApiResponse({ status: 200, description: "更新成功" })
  @ApiResponse({ status: 400, description: "请求参数错误" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "权限不足" })
  updateAll(@Body() configs: any[]) {
    return this.configService.updateAll(configs);
  }

  @Patch("group/:group")
  @UseGuards(AuthGuard("jwt"), PermissionGuard)
  @Permissions("setting:update")
  @ApiBearerAuth()
  @ApiOperation({ summary: "更新分组配置" })
  @ApiParam({ name: "group", description: "配置分组", type: "string" })
  @ApiResponse({ status: 200, description: "更新成功" })
  @ApiResponse({ status: 400, description: "请求参数错误" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "权限不足" })
  updateGroup(@Param("group") group: string, @Body() configs: any[]) {
    return this.configService.updateGroup(group, configs);
  }

  @Get("public")
  @NoAuth()
  @ApiOperation({ summary: "获取所有公共配置" })
  @ApiResponse({ status: 200, description: "获取成功" })
  getPublicConfigs() {
    return this.configService.getPublicConfigs();
  }

  @Get("advertisement")
  @NoAuth()
  @ApiOperation({ summary: "获取广告配置" })
  @ApiResponse({ status: 200, description: "获取成功" })
  getAdvertisementConfig() {
    return this.configService.getAdvertisementConfig();
  }

  // ==================== 敏感词管理 ====================

  @Get("sensitive-words")
  @UseGuards(AuthGuard("jwt"), PermissionGuard)
  @Permissions("setting:read")
  @ApiBearerAuth()
  @ApiOperation({ summary: "获取敏感词列表" })
  async findAllSensitiveWords() {
    const words = await this.configService.getSensitiveWords();
    return {
      success: true,
      data: words,
    };
  }

  @Post("sensitive-words")
  @UseGuards(AuthGuard("jwt"), PermissionGuard)
  @Permissions("setting:update")
  @ApiBearerAuth()
  @ApiOperation({ summary: "添加敏感词" })
  async createSensitiveWord(@Body() body: { word: string }) {
    await this.configService.addSensitiveWord(body.word);
    return {
      success: true,
      message: "敏感词添加成功",
    };
  }

  @Delete("sensitive-words")
  @UseGuards(AuthGuard("jwt"), PermissionGuard)
  @Permissions("setting:update")
  @ApiBearerAuth()
  @ApiOperation({ summary: "删除敏感词" })
  async removeSensitiveWord(@Body() body: { word: string }) {
    await this.configService.removeSensitiveWord(body.word);
    return {
      success: true,
      message: "敏感词删除成功",
    };
  }

  @Post("sensitive-words/batch")
  @UseGuards(AuthGuard("jwt"), PermissionGuard)
  @Permissions("setting:update")
  @ApiBearerAuth()
  @ApiOperation({ summary: "批量添加敏感词" })
  async batchCreateSensitiveWords(@Body() body: { words: string[] }) {
    await this.configService.batchAddSensitiveWords(body.words);
    return {
      success: true,
      message: `批量添加 ${body.words.length} 个敏感词成功`,
    };
  }

  @Delete("sensitive-words/batch")
  @UseGuards(AuthGuard("jwt"), PermissionGuard)
  @Permissions("setting:update")
  @ApiBearerAuth()
  @ApiOperation({ summary: "批量删除敏感词" })
  async batchRemoveSensitiveWords(@Body() body: { words: string[] }) {
    await this.configService.batchRemoveSensitiveWords(body.words);
    return {
      success: true,
      message: `批量删除 ${body.words.length} 个敏感词成功`,
    };
  }

  @Post("sensitive-words/clear-cache")
  @UseGuards(AuthGuard("jwt"), PermissionGuard)
  @Permissions("setting:update")
  @ApiBearerAuth()
  @ApiOperation({ summary: "清除敏感词缓存" })
  async clearSensitiveWordsCache() {
    await this.configService.refreshConfigCache("sensitive_words");
    return {
      success: true,
      message: "缓存清除成功",
    };
  }
}

