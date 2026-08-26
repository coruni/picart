import { ApiProperty } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import { USER_CERTIFICATION_CONSTANTS } from "src/common/constants";

export class ApplyCertificationDto {
  @ApiProperty({
    description: "认证类型：OFFICIAL-官方，CREATOR-创作者",
    enum: ["OFFICIAL", "CREATOR"],
    example: "CREATOR",
  })
  @IsNotEmpty({ message: "认证类型不能为空" })
  @IsIn(USER_CERTIFICATION_CONSTANTS.TYPE_VALUES, {
    message: "认证类型必须是 OFFICIAL（官方）或 CREATOR（创作者）",
  })
  type: (typeof USER_CERTIFICATION_CONSTANTS.TYPE_VALUES)[number];

  @ApiProperty({ description: "真实姓名/主体名称", required: false })
  @IsOptional()
  @IsString({ message: "真实姓名必须是字符串" })
  @MaxLength(50, { message: "真实姓名长度不能超过50个字符" })
  realName?: string;

  @ApiProperty({
    description: "机构名称（官方认证必填）",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "机构名称必须是字符串" })
  @MaxLength(100, { message: "机构名称长度不能超过100个字符" })
  organizationName?: string;

  @ApiProperty({ description: "认证说明", required: false })
  @IsOptional()
  @IsString({ message: "认证说明必须是字符串" })
  @MaxLength(1000, { message: "认证说明长度不能超过1000个字符" })
  description?: string;

  @ApiProperty({
    description: "认证标语（公开展示，长度不超过80字符，勿填私人信息）",
    required: false,
    example: "官方认证 · 签约摄影师",
  })
  @IsOptional()
  @IsString({ message: "认证标语必须是字符串" })
  @MaxLength(80, { message: "认证标语长度不能超过80个字符" })
  slogan?: string;

  @ApiProperty({
    description: "证明材料（文件URL数组）",
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: "证明材料必须是数组" })
  @ArrayMaxSize(10, { message: "证明材料最多10个" })
  @IsString({ message: "证明材料必须是字符串", each: true })
  materials?: string[];
}
