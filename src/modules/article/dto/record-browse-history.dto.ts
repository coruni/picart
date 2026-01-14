import { IsNumber, IsOptional, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RecordBrowseHistoryDto {
  @ApiProperty({ description: '浏览进度（百分比）', example: 50, required: false })
  @IsOptional()
  @IsNumber({}, { message: '浏览进度必须是数字' })
  @Min(0, { message: '浏览进度不能小于0' })
  @Max(100, { message: '浏览进度不能大于100' })
  progress?: number;

  @ApiProperty({ description: '停留时长（秒）', example: 120, required: false })
  @IsOptional()
  @IsNumber({}, { message: '停留时长必须是数字' })
  @Min(0, { message: '停留时长不能小于0' })
  duration?: number;
}
