import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";

export const SHARE_CHANNELS = [
  "link",
  "poster",
  "wechat",
  "moments",
  "weibo",
  "qq",
  "other",
] as const;

export type ShareChannel = (typeof SHARE_CHANNELS)[number];

const SHARE_CHANNEL_LIST: ShareChannel[] = [...SHARE_CHANNELS];

export class ShareArticleDto {
  @ApiProperty({
    description: "分享渠道",
    enum: SHARE_CHANNEL_LIST,
    example: "link",
    required: false,
    default: "link",
  })
  @IsOptional()
  @IsEnum(SHARE_CHANNEL_LIST, {
    message: `分享渠道必须是：${SHARE_CHANNELS.join(", ")} 中的一个`,
  })
  channel?: ShareChannel;
}
