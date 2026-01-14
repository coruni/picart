import { IsOptional, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryPointsTransactionDto {
  @ApiPropertyOptional({ description: '页码', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '每页数量', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({ description: '交易类型', enum: ['EARN', 'SPEND', 'ADMIN_ADJUST', 'EXPIRE', 'REFUND'] })
  @IsOptional()
  @IsEnum(['EARN', 'SPEND', 'ADMIN_ADJUST', 'EXPIRE', 'REFUND'])
  type?: 'EARN' | 'SPEND' | 'ADMIN_ADJUST' | 'EXPIRE' | 'REFUND';

  @ApiPropertyOptional({ description: '积分来源/用途' })
  @IsOptional()
  source?: string;
}
