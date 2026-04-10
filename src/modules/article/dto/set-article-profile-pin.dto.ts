import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

export class SetArticleProfilePinDto {
  @ApiProperty({ description: "是否在个人主页置顶", example: true })
  @IsBoolean({ message: "置顶状态必须是布尔值" })
  isPinned: boolean;
}
