import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTagDto {
  @ApiProperty({ description: '标签名称', example: 'JavaScript' })
  @IsNotEmpty({ message: '标签名称不能为空' })
  @IsString({ message: '标签名称必须是字符串' })
  @MaxLength(50, { message: '标签名称不能超过50个字符' })
  name: string;

  @ApiProperty({
    description: '标签描述',
    example: 'JavaScript相关文章',
    required: false,
  })
  @IsOptional()
  @IsString({ message: '标签描述必须是字符串' })
  @MaxLength(200, { message: '标签描述不能超过200个字符' })
  description?: string;

  @ApiProperty({
    description: '标签头像',
    example: 'https://example.com/avatar.jpg',
  })
  @IsOptional()
  @IsString({ message: '标签头像必须是字符串' })
  avatar: string;

  @ApiProperty({
    description: '标签背景',
    example: 'https://example.com/background.jpg',
  })
  @IsOptional()
  @IsString({ message: '标签背景必须是字符串' })
  background: string;

  @ApiProperty({
    description: '标签封面',
    example: 'https://example.com/cover.jpg',
  })
  @IsOptional()
  @IsString({ message: '标签封面必须是字符串' })
  cover: string;

  @ApiProperty({ description: '排序', example: 0, default: 0 })
  @IsOptional()
  @IsNumber({}, { message: '排序必须是数字' })
  sort?: number;
}
