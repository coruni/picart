import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString, Length, IsEnum, IsBoolean } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ description: '角色名称', example: 'admin' })
  @IsNotEmpty({ message: '角色名称不能为空' })
  @IsString({ message: '角色名称必须是字符串' })
  @Length(2, 50, { message: '角色名称长度必须在2-50个字符之间' })
  name: string;

  @ApiProperty({ description: '角色显示名称', example: '系统管理员', required: false })
  @IsOptional()
  @IsString({ message: '角色显示名称必须是字符串' })
  @Length(2, 50, { message: '角色显示名称长度必须在2-50个字符之间' })
  displayName?: string;

  @ApiProperty({ description: '角色描述', example: '系统管理员' })
  @IsNotEmpty({ message: '角色描述不能为空' })
  @IsString({ message: '角色描述必须是字符串' })
  @Length(2, 200, { message: '角色描述长度必须在2-200个字符之间' })
  description: string;

  @ApiProperty({
    description: '权限ID列表',
    example: [1, 2, 3],
    required: false,
  })
  @IsOptional()
  @IsArray({ message: '权限ID列表必须是数组' })
  permissionIds?: number[];

  @ApiProperty({
    description: '角色状态',
    example: true,
    required: false,
    default: true,
  })
  @IsOptional()
  @IsBoolean({ message: '角色状态必须是布尔值' })
  isActive?: boolean;

  @ApiProperty({
    description: '是否为系统角色',
    example: false,
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: '是否为系统角色必须是布尔值' })
  isSystem?: boolean;
}
