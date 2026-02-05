import { IsString, IsNumber, IsEnum, IsOptional, IsBoolean, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePointsActivityDto {
  @ApiProperty({ description: '活动代码' })
  @IsString()
  code: string;

  @ApiProperty({ description: '活动名称' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: '活动描述' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ 
    description: '活动类型', 
    enum: ['INSTANT', 'DAILY', 'WEEKLY', 'MONTHLY', 'ONCE'],
    example: 'INSTANT'
  })
  @IsEnum(['INSTANT', 'DAILY', 'WEEKLY', 'MONTHLY', 'ONCE'])
  type: 'INSTANT' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ONCE';

  @ApiProperty({ description: '奖励积分' })
  @IsNumber()
  @Min(1)
  rewardPoints: number;

  @ApiPropertyOptional({ description: '目标数量', default: 1 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  targetCount?: number;

  @ApiPropertyOptional({ description: '每日限制次数（0为不限制）', default: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  dailyLimit?: number;

  @ApiPropertyOptional({ description: '总限制次数（0为不限制）', default: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  totalLimit?: number;

  @ApiPropertyOptional({ description: '积分有效期（天数，0为永久）', default: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  validDays?: number;

  @ApiPropertyOptional({ description: '活动图标' })
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiPropertyOptional({ description: '跳转链接' })
  @IsString()
  @IsOptional()
  link?: string;

  @ApiPropertyOptional({ description: '是否启用', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ description: '排序', default: 0 })
  @IsNumber()
  @IsOptional()
  sort?: number;
}