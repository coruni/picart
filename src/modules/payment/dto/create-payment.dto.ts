import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty({ description: '订单ID' })
  @IsNumber()
  orderId: number;

  @ApiProperty({ description: '支付方式', enum: ['ALIPAY', 'WECHAT', 'BALANCE'] })
  @IsEnum(['ALIPAY', 'WECHAT', 'BALANCE'])
  paymentMethod: string;

  @ApiProperty({ description: '支付详情', required: false })
  @IsOptional()
  @IsString()
  details?: string;
}
