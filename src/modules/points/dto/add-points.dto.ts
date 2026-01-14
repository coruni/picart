import { IsInt, IsString, IsOptional, Min, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddPointsDto {
  @ApiProperty({ description: '积分数量' })
  @IsInt()
  @Min(1)
  amount: number;

  @ApiProperty({ description: '积分来源' })
  @IsString()
  source: string;

  @ApiPropertyOptional({ description: '描述' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '关联业务类型' })
  @IsOptional()
  @IsString()
  relatedType?: string;

  @ApiPropertyOptional({ description: '关联业务ID' })
  @IsOptional()
  @IsInt()
  relatedId?: number;

  @ApiPropertyOptional({ description: '有效天数（0为永久）', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  validDays?: number;
}
