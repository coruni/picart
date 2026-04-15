import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";

export class ArticleDislikeDto {
  @ApiPropertyOptional({
    description: "不感兴趣原因",
    example: "类似内容太多",
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
