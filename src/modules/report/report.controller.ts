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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { ReportService } from './report.service';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { QueryReportDto } from './dto/query-report.dto';

@ApiTags('举报管理')
@Controller('report')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Post()
  @ApiOperation({ summary: '创建举报' })
  @ApiResponse({ status: 201, description: '创建成功' })
  create(@Body() createReportDto: CreateReportDto, @Request() req) {
    // 从请求中获取当前用户ID，这里假设使用了认证守卫
    const reporterId = req.user?.id || 1; // 临时使用1作为默认值
    return this.reportService.create(createReportDto, reporterId);
  }

  @Get()
  @ApiOperation({ summary: '获取举报列表' })
  @ApiResponse({ status: 200, description: '获取成功' })
  findAll(@Query() queryReportDto: QueryReportDto) {
    return this.reportService.findAll(queryReportDto);
  }

  @Get('statistics')
  @ApiOperation({ summary: '获取举报统计' })
  @ApiResponse({ status: 200, description: '获取成功' })
  getStatistics() {
    return this.reportService.getStatistics();
  }

  @Get(':id')
  @ApiOperation({ summary: '获取举报详情' })
  @ApiResponse({ status: 200, description: '获取成功' })
  findOne(@Param('id') id: string) {
    return this.reportService.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新举报状态' })
  @ApiResponse({ status: 200, description: '更新成功' })
  update(@Param('id') id: string, @Body() updateReportDto: UpdateReportDto, @Request() req) {
    // 从请求中获取当前用户ID作为处理人
    const handlerId = req.user?.id || 1; // 临时使用1作为默认值
    return this.reportService.update(+id, updateReportDto, handlerId);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除举报记录' })
  @ApiResponse({ status: 200, description: '删除成功' })
  remove(@Param('id') id: string) {
    return this.reportService.remove(+id);
  }
}
