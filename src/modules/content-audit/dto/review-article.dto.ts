import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString } from "class-validator";

export class ReviewArticleDto {
  @ApiProperty({ description: "审核结果", enum: ["APPROVED", "REJECTED"] })
  @IsEnum(["APPROVED", "REJECTED"])
  result: "APPROVED" | "REJECTED";

  @ApiProperty({ description: "拒绝原因", required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}
