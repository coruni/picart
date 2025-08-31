import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsNumber, IsBoolean, Length } from 'class-validator';

export class UpdateRoleDto {
  @ApiProperty({ description: '角色名称', required: false })
  @IsString({ message: '角色名称必须是字符串' })
  @Length(2, 50, { message: '角色名称长度必须在2-50个字符之间' })
  @IsOptional()
  name?: string;

  @ApiProperty({ description: '角色显示名称', required: false })
  @IsString({ message: '角色显示名称必须是字符串' })
  @Length(2, 50, { message: '角色显示名称长度必须在2-50个字符之间' })
  @IsOptional()
  displayName?: string;

  @ApiProperty({ description: '角色描述', required: false })
  @IsString({ message: '角色描述必须是字符串' })
  @Length(2, 200, { message: '角色描述长度必须在2-200个字符之间' })
  @IsOptional()
  description?: string;

  @ApiProperty({ description: '权限ID列表', required: false, type: [Number] })
  @IsArray({ message: '权限ID列表必须是数组' })
  @IsNumber({}, { message: '权限ID必须是数字', each: true })
  @IsOptional()
  permissionIds?: number[];

  @ApiProperty({ description: '角色状态', required: false })
  @IsBoolean({ message: '角色状态必须是布尔值' })
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ description: '是否为系统角色', required: false })
  @IsBoolean({ message: '是否为系统角色必须是布尔值' })
  @IsOptional()
  isSystem?: boolean;
}
