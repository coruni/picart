import { IsInt, IsString, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SpendPointsDto {
  @ApiProperty({ description: '积分数量' })
  @IsInt()
  @Min(1)
  amount: number;

  @ApiProperty({ description: '用途' })
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
}
