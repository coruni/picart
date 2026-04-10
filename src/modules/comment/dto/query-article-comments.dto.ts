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

const transformBooleanQuery = ({ value }: { value: unknown }) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 1;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) {
      return true;
    }
    if (
      normalized === "" ||
      ["false", "0", "no", "off", "null", "undefined"].includes(normalized)
    ) {
      return false;
    }
  }

  return false;
};

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
  @Transform(transformBooleanQuery)
  @IsBoolean()
  @IsOptional()
  onlyAuthor: boolean = false;
}
