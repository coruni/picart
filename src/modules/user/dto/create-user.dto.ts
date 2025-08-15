import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ description: '用户名', example: 'admin' })
  @IsNotEmpty({ message: '用户名不能为空' })
  @IsString({ message: '用户名必须是字符串' })
  @MinLength(3, { message: '用户名长度不能小于3个字符' })
  @MaxLength(20, { message: '用户名长度不能超过20个字符' })
  username: string;

  @ApiProperty({ description: '昵称', example: '管理员', required: false })
  @IsOptional()
  @IsString({ message: '昵称必须是字符串' })
  @MaxLength(20, { message: '昵称长度不能超过20个字符' })
  nickname?: string;

  @ApiProperty({ description: '密码', example: '123456' })
  @IsNotEmpty({ message: '密码不能为空' })
  @IsString({ message: '密码必须是字符串' })
  @MinLength(6, { message: '密码长度不能小于6个字符' })
  @MaxLength(20, { message: '密码长度不能超过20个字符' })
  password: string;

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
    description: '角色ID列表（仅超级管理员可指定）',
    example: [1, 2],
    type: [Number],
    required: false,
  })
  @IsOptional()
  @IsArray({ message: '角色ID列表必须是数组' })
  @IsNumber({}, { message: '角色ID必须是数字', each: true })
  roleIds?: number[];

  @ApiProperty({
    description: '钱包余额',
    example: 0,
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: '钱包余额必须是数字' })
  wallet?: number;

  @ApiProperty({
    description: '邀请码',
    example: 'INV123456789',
    required: false,
  })
  @IsOptional()
  @IsString({ message: '邀请码必须是字符串' })
  @MaxLength(50, { message: '邀请码长度不能超过50个字符' })
  inviteCode?: string;

  @ApiProperty({
    description: '邮箱验证码',
    example: '123456',
    required: false,
  })
  @IsOptional()
  @IsString({ message: '邮箱验证码必须是字符串' })
  @MaxLength(6, { message: '邮箱验证码长度不能超过6个字符' })
  verificationCode?: string;
}