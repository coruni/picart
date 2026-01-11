import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber } from 'class-validator';

export class PurchaseDecorationDto {
  @ApiProperty({ description: '装饰品ID' })
  @IsNumber()
  @IsNotEmpty()
  decorationId: number;
}
