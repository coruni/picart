import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ description: '角色名称', example: 'admin' })
  @IsNotEmpty({ message: '角色名称不能为空' })
  @IsString({ message: '角色名称必须是字符串' })
  @Length(2, 50, { message: '角色名称长度必须在2-50个字符之间' })
  name: string;

  @ApiProperty({ description: '角色描述', example: '系统管理员' })
  @IsNotEmpty({ message: '角色描述不能为空' })
  @IsString({ message: '角色描述必须是字符串' })
  @Length(2, 100, { message: '角色描述长度必须在2-100个字符之间' })
  description: string;

  @ApiProperty({ description: '权限ID列表', example: [1, 2, 3], required: false })
  @IsOptional()
  @IsArray({ message: '权限ID列表必须是数组' })
  permissionIds?: number[];
}
