import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";

export class QueryStatisticsTrendsDto {
  @ApiPropertyOptional({
    description: "统计天数，默认 7 天，最大 30 天",
    minimum: 1,
    maximum: 30,
    default: 7,
  })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? 7 : Number(value)))
  @IsInt()
  @Min(1)
  @Max(30)
  days?: number = 7;
}
