import { IsOptional, IsNumber, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PaginationDto } from 'src/common/dto/pagination.dto';

export class QueryBrowseHistoryDto extends PaginationDto {
  @ApiProperty({ description: '开始日期', example: '2024-01-01', required: false })
  @IsOptional()
  @IsDateString({}, { message: '开始日期格式不正确' })
  startDate?: string;

  @ApiProperty({ description: '结束日期', example: '2024-12-31', required: false })
  @IsOptional()
  @IsDateString({}, { message: '结束日期格式不正确' })
  endDate?: string;

  @ApiProperty({ description: '分类ID', example: 1, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: '分类ID必须是数字' })
  categoryId?: number;
}
