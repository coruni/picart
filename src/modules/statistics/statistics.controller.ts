import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Permissions } from "src/common/decorators/permissions.decorator";
import { JwtAuthGuard } from "src/common/guards/jwt-auth.guard";
import { PermissionGuard } from "src/common/guards/permission.guard";
import { QueryStatisticsTrendsDto } from "./dto/query-statistics-trends.dto";
import { StatisticsService } from "./statistics.service";

@ApiTags("统计模块")
@Controller("statistics")
@ApiBearerAuth()
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get("overview")
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions("statistics:read", "system:monitor")
  @ApiOperation({ summary: "获取后台统计概览" })
  @ApiResponse({ status: 200, description: "获取成功" })
  getOverview() {
    return this.statisticsService.getOverview();
  }

  @Get("trends")
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions("statistics:read", "system:monitor")
  @ApiOperation({ summary: "获取最近趋势统计" })
  @ApiQuery({
    name: "days",
    required: false,
    description: "统计天数，默认 7 天，最大 30 天",
  })
  @ApiResponse({ status: 200, description: "获取成功" })
  getTrends(@Query() query: QueryStatisticsTrendsDto) {
    return this.statisticsService.getTrends(query.days || 7);
  }
}
