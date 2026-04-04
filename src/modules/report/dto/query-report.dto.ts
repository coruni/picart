import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsNumber, IsOptional, IsString } from "class-validator";
import { Type } from "class-transformer";

export class QueryReportDto {
  @ApiProperty({ description: "页码", required: false, default: 1 })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  page?: number = 1;

  @ApiProperty({ description: "每页数量", required: false, default: 10 })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  limit?: number = 10;

  @ApiProperty({
    description: "举报类型",
    enum: ["USER", "ARTICLE", "COMMENT"],
    required: false,
  })
  @IsEnum(["USER", "ARTICLE", "COMMENT"])
  @IsOptional()
  type?: "USER" | "ARTICLE" | "COMMENT";

  @ApiProperty({
    description: "处理状态",
    enum: ["PENDING", "PROCESSING", "RESOLVED", "REJECTED"],
    required: false,
  })
  @IsEnum(["PENDING", "PROCESSING", "RESOLVED", "REJECTED"])
  @IsOptional()
  status?: "PENDING" | "PROCESSING" | "RESOLVED" | "REJECTED";

  @ApiProperty({
    description: "举报分类",
    enum: ["SPAM", "ABUSE", "INAPPROPRIATE", "COPYRIGHT", "OTHER"],
    required: false,
  })
  @IsEnum(["SPAM", "ABUSE", "INAPPROPRIATE", "COPYRIGHT", "OTHER"])
  @IsOptional()
  category?: "SPAM" | "ABUSE" | "INAPPROPRIATE" | "COPYRIGHT" | "OTHER";

  @ApiProperty({ description: "举报人ID", required: false })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  reporterId?: number;

  @ApiProperty({ description: "关键词搜索（举报原因）", required: false })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiProperty({ description: "排序字段", required: false })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiProperty({
    description: "排序方向",
    enum: ["ASC", "DESC"],
    required: false,
  })
  @IsOptional()
  @IsEnum(["ASC", "DESC"])
  sortOrder?: "ASC" | "DESC";
}
