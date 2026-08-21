import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class GithubOAuthCallbackDto {
  @ApiProperty({
    description: "GitHub 授权回调返回的授权码 code",
    example: "e00b0f2c5a1d4b8e9f3a",
  })
  @IsNotEmpty({ message: "code 不能为空" })
  @IsString({ message: "code 必须是字符串" })
  code: string;

  @ApiProperty({
    description: "OAuth state 参数（CSRF 防护，由授权链接接口返回）",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "state 必须是字符串" })
  state?: string;
}
