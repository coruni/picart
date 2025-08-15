import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateUserDto {

  @ApiProperty({
    description: '头像',
    example: 'https://example.com/avatar.jpg',
    required: false,
  })
  @IsOptional()
  @IsString({ message: '头像必须是字符串' })
  avatar?: string;

  @ApiProperty({
    description: '邮箱',
    example: 'admin@example.com',
    required: false,
  })
  @IsOptional()
  @IsEmail({}, { message: '邮箱格式不正确' })
  email?: string;

  @ApiProperty({
    description: '手机号',
    example: '13800138000',
    required: false,
  })
  @IsOptional()
  @IsString({ message: '手机号必须是字符串' })
  phone?: string;

  @ApiProperty({
    description: '个人描述',
    example: '这是我的个人简介',
    required: false,
  })
  @IsOptional()
  @IsString({ message: '个人描述必须是字符串' })
  @MaxLength(500, { message: '个人描述长度不能超过500个字符' })
  description?: string;

  @ApiProperty({
    description: '地址',
    example: '北京市朝阳区',
    required: false,
  })
  @IsOptional()
  @IsString({ message: '地址必须是字符串' })
  address?: string;

  @ApiProperty({
    description: '性别',
    example: 'male',
    enum: ['male', 'female', 'other'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['male', 'female', 'other'], { message: '性别必须是 male, female 或 other' })
  gender?: string;

  @ApiProperty({
    description: '生日',
    example: '1990-01-01',
    required: false,
  })
  @IsOptional()
  birthDate?: Date;

  @ApiProperty({
    description: '角色ID列表',
    example: [1, 2],
    type: [Number],
    required: false,
  })
  @IsOptional()
  @IsArray({ message: '角色ID列表必须是数组' })
  @IsNumber({}, { message: '角色ID必须是数字', each: true })
  roleIds?: number[];
}