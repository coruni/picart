import { IsString, IsOptional, IsInt, Min, IsEnum } from "class-validator";
import { BannerStatus } from "../entities/banner.entity";

export class CreateBannerDto {
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  imageUrl: string;

  @IsString()
  @IsOptional()
  linkUrl?: string;

  @IsInt()
  @Min(0)
  sortOrder: number;

  @IsEnum(BannerStatus)
  @IsOptional()
  status?: BannerStatus;
}
