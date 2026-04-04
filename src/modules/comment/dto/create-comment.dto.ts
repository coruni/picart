import { ApiProperty } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsArray,
  ArrayMaxSize,
} from "class-validator";

export class CreateCommentDto {
  @ApiProperty({ description: "评论内容", example: "这是一条评论" })
  @IsNotEmpty({ message: "评论内容不能为空" })
  @IsString({ message: "评论内容必须是字符串" })
  content: string;

  @ApiProperty({ description: "文章ID", example: 1 })
  @IsNotEmpty({ message: "文章ID不能为空" })
  @IsNumber({}, { message: "文章ID必须是数字" })
  articleId: number;

  @ApiProperty({ description: "父评论ID", example: 1, required: false })
  @IsOptional()
  @IsNumber({}, { message: "父评论ID必须是数字" })
  parentId?: number;

  @ApiProperty({
    description: "评论图片，传单个URL字符串或URL数组（最多9张）",
    example: [
      "https://example.com/image1.jpg",
      "https://example.com/image2.jpg",
    ],
    required: false,
    oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
  })
  @IsOptional()
  images?: string | string[];
}
