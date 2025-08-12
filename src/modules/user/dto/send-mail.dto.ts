import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsEnum, IsNotEmpty, IsString } from "class-validator";

export class SendMailDto {
  @ApiProperty({
    description: "邮箱",
    example: "test@example.com",
  })
  @IsNotEmpty({ message: "邮箱不能为空" })
  @IsEmail({}, { message: "邮箱格式不正确" })
  email: string;

  @ApiProperty({
    description: "验证码类型",
    example: "verification",
    required: false,
    default: "verification",
  })
  @IsString({ message: "验证码类型必须是字符串" })
  @IsEnum(["verification", "reset_password"], {
    message: "验证码类型必须是verification或reset_password",
  })
  type?: string;
}
