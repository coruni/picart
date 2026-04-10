import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

export class SetCommentPinDto {
  @ApiProperty({ description: "是否置顶评论", example: true })
  @IsBoolean({ message: "置顶状态必须是布尔值" })
  isPinned: boolean;
}
