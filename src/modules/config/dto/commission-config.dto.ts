import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsBoolean, IsString, Min, Max } from 'class-validator';

export class GlobalCommissionConfigDto {
  @ApiProperty({ description: '文章抽成比例（0-1之间）', example: 0.1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  articleCommissionRate?: number;

  @ApiProperty({ description: '会员抽成比例（0-1之间）', example: 0.1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  membershipCommissionRate?: number;

  @ApiProperty({ description: '商品抽成比例（0-1之间）', example: 0.1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  productCommissionRate?: number;

  @ApiProperty({ description: '服务抽成比例（0-1之间）', example: 0.1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  serviceCommissionRate?: number;
}

export class UserCommissionConfigDto {
  @ApiProperty({ description: '文章抽成比例（0-1之间）', example: 0.1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  articleCommissionRate?: number;

  @ApiProperty({ description: '会员抽成比例（0-1之间）', example: 0.1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  membershipCommissionRate?: number;

  @ApiProperty({ description: '商品抽成比例（0-1之间）', example: 0.1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  productCommissionRate?: number;

  @ApiProperty({ description: '服务抽成比例（0-1之间）', example: 0.1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  serviceCommissionRate?: number;

  @ApiProperty({ description: '是否启用自定义抽成', example: false })
  @IsOptional()
  @IsBoolean()
  enableCustomCommission?: boolean;

  @ApiProperty({ description: '备注', example: '个人抽成配置' })
  @IsOptional()
  @IsString()
  remark?: string;
}

export class CalculateCommissionDto {
  @ApiProperty({ description: '金额', example: 100 })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ description: '抽成类型', enum: ['article', 'membership', 'product', 'service'] })
  @IsString()
  type: 'article' | 'membership' | 'product' | 'service';
} 