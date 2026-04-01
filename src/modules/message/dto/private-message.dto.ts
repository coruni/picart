import {
  IsArray,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";

export class CursorPaginationDto {
  @ApiProperty({ required: false, description: "游标字符串" })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiProperty({
    required: false,
    description: "每页数量",
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  limit: number = 20;
}

export class SendPrivateMessageDto {
  @ApiProperty({ description: "文本内容", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  content?: string;

  @ApiProperty({
    description: "消息类型",
    enum: ["text", "image", "file", "card"],
    default: "text",
  })
  @IsOptional()
  @IsEnum(["text", "image", "file", "card"])
  messageKind?: "text" | "image" | "file" | "card";

  @ApiProperty({ description: "结构化负载", required: false })
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}

export class BatchReadPrivateMessagesDto {
  @ApiProperty({ example: [1, 2, 3] })
  @IsArray()
  @IsNumber({}, { each: true })
  messageIds: number[];
}

export class RecallPrivateMessageDto {
  @ApiProperty({ required: false, description: "撤回原因" })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
