import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class AlipayNotifyDto {
  @ApiProperty({ description: '支付宝交易号' })
  @IsString()
  trade_no: string;

  @ApiProperty({ description: '商户订单号' })
  @IsString()
  out_trade_no: string;

  @ApiProperty({ description: '交易状态' })
  @IsString()
  trade_status: string;

  @ApiProperty({ description: '交易金额' })
  @IsString()
  total_amount: string;

  @ApiProperty({ description: '买家支付宝用户号' })
  @IsString()
  buyer_id: string;

  @ApiProperty({ description: '签名' })
  @IsString()
  sign: string;

  @ApiProperty({ description: '签名类型' })
  @IsOptional()
  @IsString()
  sign_type?: string;
}

export class WechatNotifyDto {
  @ApiProperty({ description: '微信支付订单号' })
  @IsString()
  transaction_id: string;

  @ApiProperty({ description: '商户订单号' })
  @IsString()
  out_trade_no: string;

  @ApiProperty({ description: '交易状态' })
  @IsString()
  trade_state: string;

  @ApiProperty({ description: '交易金额' })
  @IsString()
  amount: string;

  @ApiProperty({ description: '用户标识' })
  @IsString()
  openid: string;

  @ApiProperty({ description: '签名' })
  @IsString()
  sign: string;
}

export class EpayNotifyDto {
  @ApiProperty({ description: '商户ID' })
  @IsOptional()
  @IsString()
  pid?: string;

  @ApiProperty({ description: '易支付订单号' })
  @IsString()
  trade_no: string;

  @ApiProperty({ description: '商户订单号' })
  @IsString()
  out_trade_no: string;

  @ApiProperty({ description: '交易状态' })
  @IsString()
  trade_status: string;

  @ApiProperty({ description: '交易金额' })
  @IsString()
  money: string;

  @ApiProperty({ description: '支付类型' })
  @IsString()
  type: string;

  @ApiProperty({ description: '商品名称' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: '签名' })
  @IsString()
  sign: string;

  @ApiProperty({ description: '签名类型' })
  @IsOptional()
  @IsString()
  sign_type?: string;
}
