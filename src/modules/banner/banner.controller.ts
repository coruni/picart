import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  Delete,
  UseGuards,
  Req,
  Query,
  Patch,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Permissions } from "src/common/decorators/permissions.decorator";
import { PermissionGuard } from "src/common/guards/permission.guard";
import { BannerService } from "./banner.service";
import { CreateBannerDto } from "./dto/create-banner.dto";
import { UpdateBannerDto } from "./dto/update-banner.dto";
import { Banner } from "./entities/banner.entity";
import { JwtAuthGuard } from "src/common/guards/jwt-auth.guard";
import { PaginationDto } from "src/common/dto/pagination.dto";
import { NoAuth } from "src/common/decorators/no-auth.decorator";

@Controller("banners")
export class BannerController {
  constructor(private readonly bannerService: BannerService) {}

  @Post()
  @UseGuards(AuthGuard("jwt"), PermissionGuard)
  @Permissions("banner:create")
  async create(@Body() createBannerDto: CreateBannerDto) {
    return await this.bannerService.create(createBannerDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @Permissions("banner:list")
  async findAll(@Query() paginationDto: PaginationDto) {
    return await this.bannerService.findAll(paginationDto);
  }

  @Get("active")
  async findActive() {
    return await this.bannerService.findActive();
  }

  @Get(":id")
  async findOne(@Param("id") id: string) {
    return await this.bannerService.findOne(+id);
  }

  @Patch(":id")
  @UseGuards(AuthGuard("jwt"), PermissionGuard)
  @Permissions("banner:update")
  async update(
    @Param("id") id: string,
    @Body() updateBannerDto: UpdateBannerDto,
  ) {
    return await this.bannerService.update(+id, updateBannerDto);
  }

  @Delete(":id")
  @UseGuards(AuthGuard("jwt"), PermissionGuard)
  @Permissions("banner:delete")
  async remove(@Param("id") id: string) {
    return await this.bannerService.remove(+id);
  }
}
