import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateEmojiPackDto {
  @ApiProperty({ description: "表情包名称", maxLength: 100 })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ description: "表情包描述" })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: "封面图片 URL", maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  coverUrl?: string;

  @ApiPropertyOptional({ description: "是否公开", default: false })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
