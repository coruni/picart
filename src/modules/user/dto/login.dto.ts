import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length, Matches, IsEmail } from 'class-validator';

export class LoginDto {
  @ApiProperty({ 
    description: '用户名或邮箱', 
    example: 'admin 或 admin@example.com',
    oneOf: [
      { type: 'string', pattern: '^[a-zA-Z0-9_]+$' },
      { type: 'string', format: 'email' }
    ]
  })
  @IsNotEmpty({ message: '用户名或邮箱不能为空' })
  @IsString({ message: '用户名或邮箱必须是字符串' })
  @Length(4, 50, { message: '用户名或邮箱长度必须在4-50个字符之间' })
  account: string;

  @ApiProperty({ description: '密码', example: '123456' })
  @IsNotEmpty({ message: '密码不能为空' })
  @IsString({ message: '密码必须是字符串' })
  @Length(6, 20, { message: '密码长度必须在6-20个字符之间' })
  password: string;
}
