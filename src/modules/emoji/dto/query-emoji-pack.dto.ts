import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { PaginationDto } from "src/common/dto/pagination.dto";

export class QueryEmojiPackDto extends PaginationDto {
  @ApiPropertyOptional({ description: "按名称或描述搜索" })
  @IsOptional()
  @IsString()
  keyword?: string;
}
