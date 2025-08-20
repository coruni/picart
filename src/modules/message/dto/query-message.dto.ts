import { IsOptional, IsEnum, IsBoolean, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PaginationDto } from 'src/common/dto/pagination.dto';

export class QueryMessageDto extends PaginationDto {
  @ApiProperty({ description: '消息类型', enum: ['private', 'system', 'notification'], required: false })
  @IsOptional()
  @IsEnum(['private', 'system', 'notification'])
  type?: 'private' | 'system' | 'notification';

  @ApiProperty({ description: '是否已读', required: false })
  @IsOptional()
  @IsBoolean()
  isRead?: boolean;

  @ApiProperty({ description: '是否为广播消息', required: false })
  @IsOptional()
  @IsBoolean()
  isBroadcast?: boolean;

  @ApiProperty({ description: '搜索关键词', required: false })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiProperty({ description: '发送者ID', required: false })
  @IsOptional()
  senderId?: number;

  @ApiProperty({ description: '接收者ID', required: false })
  @IsOptional()
  receiverId?: number;
}
