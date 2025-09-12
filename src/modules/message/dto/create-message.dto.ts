import { IsString, IsOptional, IsNumber, IsArray, IsBoolean, IsEnum, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMessageDto {
  @ApiProperty({ description: '发送者ID', example: 1, required: false })
  @IsOptional()
  @IsNumber()
  senderId?: number | null;

  @ApiProperty({ description: '接收者ID（单发）', example: 2, required: false })
  @IsOptional()
  @IsNumber()
  receiverId?: number;

  @ApiProperty({ description: '接收者ID列表（批量）', example: [2, 3, 4], required: false })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  receiverIds?: number[];

  @ApiProperty({ description: '消息内容', example: '这是一条消息' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  content: string;

  @ApiProperty({ description: '消息标题', example: '消息标题', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiProperty({ description: '消息类型', enum: ['private', 'system', 'notification'], default: 'private' })
  @IsOptional()
  @IsEnum(['private', 'system', 'notification'])
  type?: 'private' | 'system' | 'notification';

  @ApiProperty({ description: '是否为广播消息', default: false })
  @IsOptional()
  @IsBoolean()
  isBroadcast?: boolean;

  @ApiProperty({ description: '消息元数据', required: false })
  @IsOptional()
  metadata?: any;
}
