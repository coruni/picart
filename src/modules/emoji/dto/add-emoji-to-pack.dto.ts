import { ApiProperty } from "@nestjs/swagger";
import { IsInt, Min } from "class-validator";

export class AddEmojiToPackDto {
  @ApiProperty({ description: "表情 ID" })
  @IsInt()
  @Min(1)
  emojiId: number;

  @ApiProperty({ description: "在表情包中的排序", default: 0 })
  @IsInt()
  @Min(0)
  sort: number = 0;
}
