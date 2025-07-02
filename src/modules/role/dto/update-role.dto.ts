import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsNumber } from 'class-validator';

export class UpdateRoleDto {
  @ApiProperty({ description: '角色名称', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ description: '角色描述', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: '权限ID列表', required: false, type: [Number] })
  @IsArray()
  @IsNumber({}, { each: true })
  @IsOptional()
  permissionIds?: number[];
}
