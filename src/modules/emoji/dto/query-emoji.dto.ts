import { IsOptional, IsString, IsEnum, IsBoolean } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { PaginationDto } from "src/common/dto/pagination.dto";
import { Transform } from "class-transformer";

export class QueryEmojiDto extends PaginationDto {
  @ApiProperty({
    description: "Return grouped data for tabs/folders",
    required: false,
    default: true,
  })
  @IsOptional()
  @Transform(
    ({ value }) => value === undefined || value === "true" || value === true,
  )
  @IsBoolean()
  grouped?: boolean = true;

  @ApiProperty({
    description: "Emoji type",
    enum: ["system", "user"],
    required: false,
  })
  @IsOptional()
  @IsEnum(["system", "user"])
  type?: "system" | "user";

  @ApiProperty({ description: "Category", required: false })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ description: "Keyword search", required: false })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiProperty({ description: "Is public", required: false })
  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  isPublic?: boolean;

  @ApiProperty({
    description: "Status",
    enum: ["active", "inactive", "deleted"],
    required: false,
  })
  @IsOptional()
  @IsEnum(["active", "inactive", "deleted"])
  status?: "active" | "inactive" | "deleted";

  @ApiProperty({ description: "User id", required: false })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({ description: "Only return favorites", required: false })
  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  onlyFavorites?: boolean;

  @ApiProperty({ description: "Sort by field", required: false })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiProperty({
    description: "Sort order",
    enum: ["ASC", "DESC"],
    required: false,
  })
  @IsOptional()
  @IsEnum(["ASC", "DESC"])
  sortOrder?: "ASC" | "DESC";
}
