import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateReportDto {
  @ApiProperty({
    description: '处理状态',
    enum: ['PENDING', 'PROCESSING', 'RESOLVED', 'REJECTED'],
    required: false,
  })
  @IsEnum(['PENDING', 'PROCESSING', 'RESOLVED', 'REJECTED'])
  @IsOptional()
  status?: 'PENDING' | 'PROCESSING' | 'RESOLVED' | 'REJECTED';

  @ApiProperty({
    description: '处理动作',
    enum: ['DELETE_CONTENT', 'BAN_USER', 'WARNING', 'NONE'],
    required: false,
    example: 'DELETE_CONTENT',
  })
  @IsEnum(['DELETE_CONTENT', 'BAN_USER', 'WARNING', 'NONE'])
  @IsOptional()
  action?: 'DELETE_CONTENT' | 'BAN_USER' | 'WARNING' | 'NONE';

  @ApiProperty({ description: '处理结果', required: false })
  @IsString()
  @IsOptional()
  result?: string;
}
