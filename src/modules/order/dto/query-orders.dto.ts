import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryOrdersDto {
  @ApiProperty({ description: '页码', required: false, default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page: number = 1;

  @ApiProperty({
    description: '每页数量',
    required: false,
    default: 10,
    minimum: 1,
    maximum: 100,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit: number = 10;

  @ApiProperty({
    description: '订单状态',
    required: false,
    enum: ['PENDING', 'PAID', 'CANCELLED', 'REFUNDED'],
  })
  @IsEnum(['PENDING', 'PAID', 'CANCELLED', 'REFUNDED'])
  @IsOptional()
  status?: string;

  @ApiProperty({
    description: '订单类型',
    required: false,
    enum: ['MEMBERSHIP', 'PRODUCT', 'SERVICE', 'ARTICLE'],
  })
  @IsEnum(['MEMBERSHIP', 'PRODUCT', 'SERVICE', 'ARTICLE'])
  @IsOptional()
  type?: string;
}
