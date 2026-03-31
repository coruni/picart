import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateUserContactDto {
  @ApiProperty({
    description: "新邮箱",
    example: "new-email@example.com",
    required: false,
  })
  @IsOptional()
  @IsEmail({}, { message: "邮箱格式不正确" })
  email?: string;

  @ApiProperty({
    description: "新手机号",
    example: "13800138000",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "手机号必须是字符串" })
  @MaxLength(20, { message: "手机号长度不能超过20个字符" })
  phone?: string;

  @ApiProperty({
    description: "邮箱验证码，仅修改邮箱时需要",
    example: "123456",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "邮箱验证码必须是字符串" })
  @MaxLength(6, { message: "邮箱验证码长度不能超过6个字符" })
  verificationCode?: string;
}
