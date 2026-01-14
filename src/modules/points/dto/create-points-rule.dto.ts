import { IsString, IsInt, IsBoolean, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePointsRuleDto {
  @ApiProperty({ description: '规则代码' })
  @IsString()
  code: string;

  @ApiProperty({ description: '规则名称' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: '规则描述' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: '积分数量' })
  @IsInt()
  points: number;

  @ApiPropertyOptional({ description: '每日限制次数', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  dailyLimit?: number;

  @ApiPropertyOptional({ description: '总限制次数', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  totalLimit?: number;

  @ApiPropertyOptional({ description: '积分有效期（天数）', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  validDays?: number;

  @ApiPropertyOptional({ description: '是否启用', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: '排序', default: 0 })
  @IsOptional()
  @IsInt()
  sort?: number;
}
