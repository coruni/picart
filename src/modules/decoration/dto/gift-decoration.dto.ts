import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class GiftDecorationDto {
  @ApiProperty({ description: '接收者用户ID' })
  @IsNumber()
  @IsNotEmpty()
  toUserId: number;

  @ApiProperty({ description: '装饰品ID' })
  @IsNumber()
  @IsNotEmpty()
  decorationId: number;

  @ApiProperty({ description: '赠送留言', required: false })
  @IsString()
  @IsOptional()
  message?: string;
}
