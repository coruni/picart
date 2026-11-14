import { ApiProperty } from "@nestjs/swagger";
import { IsInt, Min } from "class-validator";

export class UpdateEmojiPackItemDto {
  @ApiProperty({ description: "在表情包中的排序" })
  @IsInt()
  @Min(0)
  sort: number;
}
