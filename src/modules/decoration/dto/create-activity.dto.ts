import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsBoolean,
  IsDateString,
  Min,
} from 'class-validator';

export class CreateActivityDto {
  @ApiProperty({ description: '活动名称' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: '活动描述', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: '活动类型',
    enum: ['LIKE', 'COMMENT', 'SHARE', 'RECHARGE', 'SIGN_IN', 'CUSTOM'],
  })
  @IsEnum(['LIKE', 'COMMENT', 'SHARE', 'RECHARGE', 'SIGN_IN', 'CUSTOM'])
  @IsNotEmpty()
  type: 'LIKE' | 'COMMENT' | 'SHARE' | 'RECHARGE' | 'SIGN_IN' | 'CUSTOM';

  @ApiProperty({ description: '奖励装饰品ID' })
  @IsNumber()
  @IsNotEmpty()
  decorationId: number;

  @ApiProperty({ description: '所需点赞数', required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  requiredLikes?: number;

  @ApiProperty({ description: '所需评论数', required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  requiredComments?: number;

  @ApiProperty({ description: '所需分享数', required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  requiredShares?: number;

  @ApiProperty({ description: '所需充值金额', required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  requiredRecharge?: number;

  @ApiProperty({ description: '所需签到天数', required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  requiredSignInDays?: number;

  @ApiProperty({ description: '奖励是否永久' })
  @IsBoolean()
  @IsNotEmpty()
  isPermanent: boolean;

  @ApiProperty({ description: '奖励有效天数', required: false })
  @IsNumber()
  @Min(1)
  @IsOptional()
  validDays?: number;

  @ApiProperty({ description: '开始时间' })
  @IsDateString()
  @IsNotEmpty()
  startTime: string;

  @ApiProperty({ description: '结束时间' })
  @IsDateString()
  @IsNotEmpty()
  endTime: string;
}
