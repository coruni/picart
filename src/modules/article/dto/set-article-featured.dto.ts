import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

export class SetArticleFeaturedDto {
  @ApiProperty({ description: "是否设为精华", example: true })
  @IsBoolean({ message: "设精状态必须是布尔值" })
  isFeatured: boolean;
}
