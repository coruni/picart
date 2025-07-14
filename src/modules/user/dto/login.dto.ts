import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class LoginDto {
  @ApiProperty({ description: '用户名', example: 'admin' })
  @IsNotEmpty({ message: '用户名不能为空' })
  @IsString({ message: '用户名必须是字符串' })
  @Length(4, 20, { message: '用户名长度必须在4-20个字符之间' })
  @Matches(/^[a-zA-Z0-9_]+$/, { message: '用户名只能包含字母、数字和下划线' })
  username: string;

  @ApiProperty({ description: '设备ID', example: 'device-uuid-123' })
  @IsNotEmpty({ message: '设备ID不能为空' })
  @IsString({ message: '设备ID必须是字符串' })
  deviceId: string;

  @ApiProperty({ description: '设备类型', example: 'iOS/Android/Web', required: false })
  @IsString({ message: '设备类型必须是字符串' })
  deviceType?: string;

  @ApiProperty({ description: '设备名称', example: 'iPhone 15', required: false })
  @IsString({ message: '设备名称必须是字符串' })
  deviceName?: string;

  @ApiProperty({ description: '密码', example: '123456' })
  @IsNotEmpty({ message: '密码不能为空' })
  @IsString({ message: '密码必须是字符串' })
  @Length(6, 20, { message: '密码长度必须在6-20个字符之间' })
  password: string;
}
