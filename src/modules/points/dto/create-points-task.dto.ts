import { IsString, IsInt, IsBoolean, IsOptional, IsEnum, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePointsTaskDto {
  @ApiProperty({ description: '任务代码' })
  @IsString()
  code: string;

  @ApiProperty({ description: '任务名称' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: '任务描述' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: '任务类型', enum: ['DAILY', 'WEEKLY', 'MONTHLY', 'ONCE'] })
  @IsEnum(['DAILY', 'WEEKLY', 'MONTHLY', 'ONCE'])
  type: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ONCE';

  @ApiProperty({ description: '奖励积分' })
  @IsInt()
  @Min(1)
  rewardPoints: number;

  @ApiPropertyOptional({ description: '目标数量', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  targetCount?: number;

  @ApiPropertyOptional({ description: '任务图标' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ description: '跳转链接' })
  @IsOptional()
  @IsString()
  link?: string;

  @ApiPropertyOptional({ description: '是否启用', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: '排序', default: 0 })
  @IsOptional()
  @IsInt()
  sort?: number;
}
