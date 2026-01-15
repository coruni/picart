import { IsString, IsOptional, IsInt, Min, IsEnum } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { BannerStatus } from "../entities/banner.entity";

export class CreateBannerDto {
  @ApiProperty({
    description: "轮播标题",
    example: "新年促销活动",
  })
  @IsString()
  title: string;

  @ApiPropertyOptional({
    description: "轮播描述",
    example: "全场商品8折优惠",
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: "轮播图片URL",
    example: "https://example.com/banner.jpg",
  })
  @IsString()
  imageUrl: string;

  @ApiPropertyOptional({
    description: "跳转链接URL",
    example: "https://example.com/promotion",
  })
  @IsString()
  @IsOptional()
  linkUrl?: string;

  @ApiProperty({
    description: "排序顺序（数字越大越靠前）",
    example: 1,
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  sortOrder: number;

  @ApiPropertyOptional({
    description: "轮播状态",
    enum: BannerStatus,
    example: BannerStatus.ACTIVE,
    default: BannerStatus.ACTIVE,
  })
  @IsEnum(BannerStatus)
  @IsOptional()
  status?: BannerStatus;
}
