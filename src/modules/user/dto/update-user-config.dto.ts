import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsNumber, IsString, Min, Max } from 'class-validator';

export class UpdateUserConfigDto {
  @ApiProperty({ description: '文章抽成比例（0-1之间）', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  articleCommissionRate?: number;

  @ApiProperty({ description: '会员抽成比例（0-1之间）', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  membershipCommissionRate?: number;

  @ApiProperty({ description: '商品抽成比例（0-1之间）', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  productCommissionRate?: number;

  @ApiProperty({ description: '服务抽成比例（0-1之间）', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  serviceCommissionRate?: number;

  @ApiProperty({ description: '是否启用自定义抽成', required: false })
  @IsOptional()
  @IsBoolean()
  enableCustomCommission?: boolean;

  // 通知设置
  @ApiProperty({ description: '是否接收系统通知', required: false })
  @IsOptional()
  @IsBoolean()
  enableSystemNotification?: boolean;

  @ApiProperty({ description: '是否接收评论通知', required: false })
  @IsOptional()
  @IsBoolean()
  enableCommentNotification?: boolean;

  @ApiProperty({ description: '是否接收点赞通知', required: false })
  @IsOptional()
  @IsBoolean()
  enableLikeNotification?: boolean;

  @ApiProperty({ description: '是否接收关注通知', required: false })
  @IsOptional()
  @IsBoolean()
  enableFollowNotification?: boolean;

  @ApiProperty({ description: '是否接收私信通知', required: false })
  @IsOptional()
  @IsBoolean()
  enableMessageNotification?: boolean;

  @ApiProperty({ description: '是否接收订单通知', required: false })
  @IsOptional()
  @IsBoolean()
  enableOrderNotification?: boolean;

  @ApiProperty({ description: '是否接收支付通知', required: false })
  @IsOptional()
  @IsBoolean()
  enablePaymentNotification?: boolean;

  @ApiProperty({ description: '是否接收邀请通知', required: false })
  @IsOptional()
  @IsBoolean()
  enableInviteNotification?: boolean;

  @ApiProperty({ description: '是否接收邮件通知', required: false })
  @IsOptional()
  @IsBoolean()
  enableEmailNotification?: boolean;

  @ApiProperty({ description: '是否接收短信通知', required: false })
  @IsOptional()
  @IsBoolean()
  enableSmsNotification?: boolean;

  @ApiProperty({ description: '是否接收推送通知', required: false })
  @IsOptional()
  @IsBoolean()
  enablePushNotification?: boolean;

  @ApiProperty({ description: '备注', required: false })
  @IsOptional()
  @IsString()
  remark?: string;
}
