import { IsString, IsOptional, IsBoolean, IsEnum, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateMessageDto {
  @ApiProperty({ description: '消息内容', example: '更新的消息内容', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  content?: string;

  @ApiProperty({ description: '消息标题', example: '更新的消息标题', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiProperty({ description: '是否已读', required: false })
  @IsOptional()
  @IsBoolean()
  isRead?: boolean;

  @ApiProperty({ description: '消息类型', enum: ['private', 'system', 'notification'], required: false })
  @IsOptional()
  @IsEnum(['private', 'system', 'notification'])
  type?: 'private' | 'system' | 'notification';

  @ApiProperty({ description: '是否为广播消息', required: false })
  @IsOptional()
  @IsBoolean()
  isBroadcast?: boolean;

  @ApiProperty({ description: '消息元数据', required: false })
  @IsOptional()
  metadata?: any;
}
