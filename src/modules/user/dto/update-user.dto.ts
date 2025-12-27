import { ApiProperty, PartialType } from "@nestjs/swagger";

import {
  IsArray,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import { CreateUserDto } from "./create-user.dto";

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiProperty({
    description: "头像",
    example: "https://example.com/avatar.jpg",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "头像必须是字符串" })
  avatar?: string;

  @ApiProperty({ description: "昵称", example: "管理员", required: false })
  @IsOptional()
  @IsString({ message: "昵称必须是字符串" })
  @MaxLength(20, { message: "昵称长度不能超过20个字符" })
  nickname?: string;

  @ApiProperty({
    description: "邮箱",
    example: "admin@example.com",
    required: false,
  })
  @IsOptional()
  @IsEmail({}, { message: "邮箱格式不正确" })
  email?: string;

  @ApiProperty({
    description: "手机号",
    example: "13800138000",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "手机号必须是字符串" })
  phone?: string;

  @ApiProperty({
    description: "个人描述",
    example: "这是我的个人简介",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "个人描述必须是字符串" })
  @MaxLength(500, { message: "个人描述长度不能超过500个字符" })
  description?: string;

  @ApiProperty({
    description: "个人背景",
    example: "https://example.com/background.jpg",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "个人背景必须是字符串" })
  background?: string;

  @ApiProperty({
    description: "地址",
    example: "北京市朝阳区",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "地址必须是字符串" })
  address?: string;

  @ApiProperty({
    description: "性别",
    example: "male",
    enum: ["male", "female", "other"],
    required: false,
  })
  @IsOptional()
  @IsEnum(["male", "female", "other"], {
    message: "性别必须是 male, female 或 other",
  })
  gender?: string;

  @ApiProperty({
    description: "生日",
    example: "1990-01-01",
    required: false,
  })
  @IsOptional()
  birthDate?: Date;

  @ApiProperty({
    description: "角色ID列表",
    example: [1, 2],
    type: [Number],
    required: false,
  })
  @IsOptional()
  @IsArray({ message: "角色ID列表必须是数组" })
  @IsNumber({}, { message: "角色ID必须是数字", each: true })
  roleIds?: number[];

  // 会员相关字段（仅管理员可修改）
  @ApiProperty({
    description: "会员等级",
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: "会员等级必须是数字" })
  membershipLevel?: number;

  @ApiProperty({
    description: "会员等级名称",
    example: "青铜会员",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "会员等级名称必须是字符串" })
  membershipLevelName?: string;

  @ApiProperty({
    description: "会员状态",
    example: "ACTIVE",
    enum: ["ACTIVE", "INACTIVE"],
    required: false,
  })
  @IsOptional()
  @IsEnum(["ACTIVE", "INACTIVE"], { message: "会员状态必须是 ACTIVE 或 INACTIVE" })
  membershipStatus?: string;

  @ApiProperty({
    description: "会员开通时间",
    example: "2024-01-01T00:00:00.000Z",
    required: false,
  })
  @IsOptional()
  membershipStartDate?: Date;

  @ApiProperty({
    description: "会员到期时间",
    example: "2024-12-31T23:59:59.999Z",
    required: false,
  })
  @IsOptional()
  membershipEndDate?: Date;

  @ApiProperty({
    description: "用户状态",
    example: "ACTIVE",
    enum: ["ACTIVE", "INACTIVE", "BANNED"],
    required: false,
  })
  @IsOptional()
  @IsEnum(["ACTIVE", "INACTIVE", "BANNED"], { 
    message: "用户状态必须是 ACTIVE、INACTIVE 或 BANNED" 
  })
  status?: string;

  @ApiProperty({
    description: "封禁时间",
    example: "2024-12-31T23:59:59.999Z",
    required: false,
  })
  @IsOptional()
  banned?: Date;

  @ApiProperty({
    description: "封禁原因",
    example: "违反社区规定",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "封禁原因必须是字符串" })
  banReason?: string;
}
