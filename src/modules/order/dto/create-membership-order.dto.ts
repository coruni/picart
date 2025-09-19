import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateMembershipOrderDto {
  @ApiProperty({ description: '套餐：1m/3m/6m/12m/lifetime（可选）', required: false })
  @IsOptional()
  @IsString()
  @IsIn(['1m', '3m', '6m', '12m', 'lifetime'])
  plan?: string;

  @ApiProperty({ description: '充值时长（月）（当未选择套餐时必填）', required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  duration?: number;

  @ApiProperty({ description: '备注', required: false })
  @IsOptional()
  @IsString()
  remark?: string;
}
