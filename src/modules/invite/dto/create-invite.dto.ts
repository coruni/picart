import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, IsEnum, IsDateString, Min, Max } from 'class-validator';

export class CreateInviteDto {
  @ApiProperty({ description: '邀请类型', enum: ['GENERAL', 'VIP'], default: 'GENERAL' })
  @IsOptional()
  @IsEnum(['GENERAL', 'VIP'])
  type?: string;

  @ApiProperty({ description: '邀请分成比例（0-1之间）', example: 0.05, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  commissionRate?: number;

  @ApiProperty({ description: '过期时间', required: false })
  @IsOptional()
  @IsDateString()
  expiredAt?: string;

  @ApiProperty({ description: '备注', required: false })
  @IsOptional()
  @IsString()
  remark?: string;
} 