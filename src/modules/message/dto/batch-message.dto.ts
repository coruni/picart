import { IsArray, IsNumber, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BatchMessageDto {
  @ApiProperty({ description: '消息ID列表', example: [1, 2, 3] })
  @IsArray()
  @IsNumber({}, { each: true })
  messageIds: number[];

  @ApiProperty({ description: '操作类型', enum: ['read', 'delete'], example: 'read' })
  @IsEnum(['read', 'delete'])
  action: 'read' | 'delete';
}

export class MarkAllReadDto {
  @ApiProperty({ description: '消息类型', enum: ['private', 'system', 'notification'], required: false })
  @IsOptional()
  @IsEnum(['private', 'system', 'notification'])
  type?: 'private' | 'system' | 'notification';

  @ApiProperty({ description: '是否为广播消息', required: false })
  @IsOptional()
  isBroadcast?: boolean;
}
