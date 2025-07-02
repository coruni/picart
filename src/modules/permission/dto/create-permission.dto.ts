import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class CreatePermissionDto {
  @ApiProperty({ description: '权限名称', example: 'user:create' })
  @IsNotEmpty({ message: '权限名称不能为空' })
  @IsString({ message: '权限名称必须是字符串' })
  @Length(3, 50, { message: '权限名称长度必须在3-50个字符之间' })
  name: string;

  @ApiProperty({ description: '权限描述', example: '创建用户' })
  @IsNotEmpty({ message: '权限描述不能为空' })
  @IsString({ message: '权限描述必须是字符串' })
  @Length(2, 100, { message: '权限描述长度必须在2-100个字符之间' })
  description: string;
}
