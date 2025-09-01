import { IsBoolean, IsOptional } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class UpdateUserNoticeDto {
    @ApiProperty({ description: '是否接收系统通知', required: false })
    @IsBoolean()
    @IsOptional()
    enableSystemNotification?: boolean;

    @ApiProperty({ description: '是否接收评论通知', required: false })
    @IsBoolean()
    @IsOptional()
    enableCommentNotification?: boolean;

    @ApiProperty({ description: '是否接收点赞通知', required: false })
    @IsBoolean()
    @IsOptional()
    enableLikeNotification?: boolean;

    @ApiProperty({ description: '是否接收关注通知', required: false })
    @IsBoolean()
    @IsOptional()
    enableFollowNotification?: boolean;

    @ApiProperty({ description: '是否接收私信通知', required: false })
    @IsBoolean()
    @IsOptional()
    enableMessageNotification?: boolean;

    @ApiProperty({ description: '是否接收订单通知', required: false })
    @IsBoolean()
    @IsOptional()
    enableOrderNotification?: boolean;

    @ApiProperty({ description: '是否接收支付通知', required: false })
    @IsBoolean()
    @IsOptional()
    enablePaymentNotification?: boolean;

    @ApiProperty({ description: '是否接收邀请通知', required: false })
    @IsBoolean()
    @IsOptional()
    enableInviteNotification?: boolean;

    @ApiProperty({ description: '是否接收邮件通知', required: false })
    @IsBoolean()
    @IsOptional()
    enableEmailNotification?: boolean;

    @ApiProperty({ description: '是否接收短信通知', required: false })
    @IsBoolean()
    @IsOptional()
    enableSmsNotification?: boolean;

    @ApiProperty({ description: '是否接收推送通知', required: false })
    @IsBoolean()
    @IsOptional()
    enablePushNotification?: boolean;
}