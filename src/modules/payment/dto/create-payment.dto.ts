import { ApiProperty } from "@nestjs/swagger";
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateIf,
} from "class-validator";

export class CreatePaymentDto {
  @ApiProperty({ description: "订单ID" })
  @IsNumber()
  orderId: number;

  @ApiProperty({
    description: "支付方式",
    enum: ["ALIPAY", "WECHAT", "BALANCE", "EPAY"],
  })
  @IsEnum(["ALIPAY", "WECHAT", "BALANCE", "EPAY"])
  paymentMethod: string;

  @ApiProperty({ description: "支付完成后的跳转地址", required: false })
  @IsOptional()
  @IsString()
  returnUrl?: string;

  @ApiProperty({
    description: "支付类型（EPAY支付方式时必传）",
    enum: ["wxpay", "alipay"],
    required: false,
  })
  @ValidateIf((o) => o.paymentMethod === "EPAY")
  @IsEnum(["wxpay", "alipay"])
  type?: string;
}
