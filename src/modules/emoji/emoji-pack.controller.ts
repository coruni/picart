import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { NoAuth } from "src/common/decorators/no-auth.decorator";
import { User } from "../user/entities/user.entity";
import { AddEmojiToPackDto } from "./dto/add-emoji-to-pack.dto";
import { CreateEmojiPackDto } from "./dto/create-emoji-pack.dto";
import { QueryEmojiPackDto } from "./dto/query-emoji-pack.dto";
import { UpdateEmojiPackItemDto } from "./dto/update-emoji-pack-item.dto";
import { UpdateEmojiPackDto } from "./dto/update-emoji-pack.dto";
import { EmojiPackService } from "./emoji-pack.service";

@ApiTags("表情包管理")
@Controller("emoji/packs")
export class EmojiPackController {
  constructor(private readonly emojiPackService: EmojiPackService) {}

  @Post()
  @UseGuards(AuthGuard("jwt"))
  @ApiBearerAuth()
  @ApiOperation({ summary: "创建表情包" })
  create(
    @Body() dto: CreateEmojiPackDto,
    @Req() req: Request & { user: User },
  ) {
    return this.emojiPackService.create(dto, req.user);
  }

  @Get()
  @NoAuth()
  @ApiOperation({ summary: "获取公开或自己的表情包列表" })
  findAll(
    @Query() query: QueryEmojiPackDto,
    @Req() req: Request & { user?: User },
  ) {
    return this.emojiPackService.findAll(query, req.user);
  }

  @Get(":id")
  @NoAuth()
  @ApiOperation({ summary: "获取表情包详情" })
  @ApiParam({ name: "id", description: "表情包 ID" })
  findOne(
    @Param("id", ParseIntPipe) id: number,
    @Req() req: Request & { user?: User },
  ) {
    return this.emojiPackService.findOne(id, req.user);
  }

  @Patch(":id")
  @UseGuards(AuthGuard("jwt"))
  @ApiBearerAuth()
  @ApiOperation({ summary: "更新表情包" })
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateEmojiPackDto,
    @Req() req: Request & { user: User },
  ) {
    return this.emojiPackService.update(id, dto, req.user);
  }

  @Delete(":id")
  @UseGuards(AuthGuard("jwt"))
  @ApiBearerAuth()
  @ApiOperation({ summary: "删除表情包" })
  remove(
    @Param("id", ParseIntPipe) id: number,
    @Req() req: Request & { user: User },
  ) {
    return this.emojiPackService.remove(id, req.user);
  }

  @Post(":id/emojis")
  @UseGuards(AuthGuard("jwt"))
  @ApiBearerAuth()
  @ApiOperation({ summary: "向表情包添加表情" })
  addEmoji(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: AddEmojiToPackDto,
    @Req() req: Request & { user: User },
  ) {
    return this.emojiPackService.addEmoji(id, dto, req.user);
  }

  @Patch(":id/emojis/:emojiId")
  @UseGuards(AuthGuard("jwt"))
  @ApiBearerAuth()
  @ApiOperation({ summary: "调整表情在表情包中的顺序" })
  updateEmojiSort(
    @Param("id", ParseIntPipe) id: number,
    @Param("emojiId", ParseIntPipe) emojiId: number,
    @Body() dto: UpdateEmojiPackItemDto,
    @Req() req: Request & { user: User },
  ) {
    return this.emojiPackService.updateEmojiSort(id, emojiId, dto, req.user);
  }

  @Delete(":id/emojis/:emojiId")
  @UseGuards(AuthGuard("jwt"))
  @ApiBearerAuth()
  @ApiOperation({ summary: "从表情包移除表情" })
  removeEmoji(
    @Param("id", ParseIntPipe) id: number,
    @Param("emojiId", ParseIntPipe) emojiId: number,
    @Req() req: Request & { user: User },
  ) {
    return this.emojiPackService.removeEmoji(id, emojiId, req.user);
  }
}
