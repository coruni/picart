import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty({ description: '订单ID' })
  @IsNumber()
  orderId: number;

  @ApiProperty({ description: '支付方式', enum: ['ALIPAY', 'WECHAT', 'BALANCE', 'EPAY'] })
  @IsEnum(['ALIPAY', 'WECHAT', 'BALANCE', 'EPAY'])
  paymentMethod: string;

  @ApiProperty({ description: '支付完成后的跳转地址', required: false })
  @IsOptional()
  @IsString()
  returnUrl?: string;
}
