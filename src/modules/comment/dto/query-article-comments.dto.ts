import { Transform, Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from "class-validator";

export enum CommentSortBy {
  LATEST = "latest",
  OLDEST = "oldest",
  HOT = "hot",
}

export class QueryArticleCommentsDto {
  @ApiPropertyOptional({ description: "页码", default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page: number = 1;

  @ApiPropertyOptional({
    description: "每页数量",
    default: 10,
    minimum: 1,
    maximum: 100,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit: number = 10;

  @ApiPropertyOptional({
    description: "排序方式",
    enum: CommentSortBy,
    default: CommentSortBy.LATEST,
  })
  @IsEnum(CommentSortBy)
  @IsOptional()
  sortBy: CommentSortBy = CommentSortBy.LATEST;

  @ApiPropertyOptional({
    description: "是否只看帖主",
    default: false,
  })
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  @IsOptional()
  onlyAuthor: boolean = false;
}
