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
  Request,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { ReportService } from "./report.service";
import { CreateReportDto } from "./dto/create-report.dto";
import { UpdateReportDto } from "./dto/update-report.dto";
import { QueryReportDto } from "./dto/query-report.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionGuard } from "../../common/guards/permission.guard";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { User } from "../user/entities/user.entity";

@ApiTags("举报管理")
@Controller("report")
@ApiBearerAuth()
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "创建举报" })
  @ApiResponse({ status: 201, description: "创建成功" })
  create(
    @Body() createReportDto: CreateReportDto,
    @Request() req: Request & { user: User },
  ) {
    return this.reportService.create(createReportDto, req.user.id);
  }

  @Get()
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions("report:manage")
  @ApiOperation({ summary: "获取举报列表" })
  @ApiResponse({ status: 200, description: "获取成功" })
  findAll(@Query() queryReportDto: QueryReportDto) {
    return this.reportService.findAll(queryReportDto);
  }

  @Get("statistics")
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions("report:manage")
  @ApiOperation({ summary: "获取举报统计" })
  @ApiResponse({ status: 200, description: "获取成功" })
  getStatistics() {
    return this.reportService.getStatistics();
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions("report:manage")
  @ApiOperation({ summary: "获取举报详情" })
  @ApiResponse({ status: 200, description: "获取成功" })
  findOne(@Param("id") id: string) {
    return this.reportService.findOne(+id);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions("report:manage")
  @ApiOperation({ summary: "更新举报状态" })
  @ApiResponse({ status: 200, description: "更新成功" })
  update(
    @Param("id") id: string,
    @Body() updateReportDto: UpdateReportDto,
    @Request() req: Request & { user: User },
  ) {
    return this.reportService.update(+id, updateReportDto, req.user.id);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions("report:manage")
  @ApiOperation({ summary: "删除举报记录" })
  @ApiResponse({ status: 200, description: "删除成功" })
  remove(@Param("id") id: string) {
    return this.reportService.remove(+id);
  }
}
