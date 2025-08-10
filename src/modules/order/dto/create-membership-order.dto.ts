import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateMembershipOrderDto {
  @ApiProperty({ description: '充值时长（月）' })
  @IsNumber()
  @Min(1)
  duration: number;

  @ApiProperty({ description: '备注', required: false })
  @IsOptional()
  @IsString()
  remark?: string;
}
