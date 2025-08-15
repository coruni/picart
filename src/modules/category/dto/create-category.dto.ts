import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ description: '分类名称', example: '技术' })
  @IsNotEmpty({ message: '分类名称不能为空' })
  @IsString({ message: '分类名称必须是字符串' })
  @MaxLength(50, { message: '分类名称不能超过50个字符' })
  name: string;

  @ApiProperty({
    description: '分类描述',
    example: '技术相关文章',
    required: false,
  })
  @IsOptional()
  @IsString({ message: '分类描述必须是字符串' })
  @MaxLength(200, { message: '分类描述不能超过200个字符' })
  description?: string;

  @ApiProperty({ description: '排序', example: 0, default: 0 })
  @IsOptional()
  @IsNumber({}, { message: '排序必须是数字' })
  sort?: number;

  @ApiProperty({ description: '父分类ID', example: 1, required: false })
  @IsOptional()
  @IsNumber({}, { message: '父分类ID必须是数字' })
  parentId?: number;

  @ApiProperty({ description: '自定义链接', example: 'https://example.com', required: false })
  @IsOptional()
  @IsString({ message: '自定义链接必须是字符串' })
  link?: string;

  @ApiProperty({
    description: '分类头像',
    example: 'https://example.com/avatar.jpg',
    required: false,
  })
  @IsOptional()
  @IsString({ message: '分类头像必须是字符串' })
  avatar?: string;

  @ApiProperty({
    description: '分类背景',
    example: 'https://example.com/background.jpg',
    required: false,
  })
  @IsOptional()
  @IsString({ message: '分类背景必须是字符串' })
  background?: string;

  @ApiProperty({
    description: '分类封面',
    example: 'https://example.com/cover.jpg',
    required: false,
  })
  @IsOptional()
  @IsString({ message: '分类封面必须是字符串' })
  cover?: string;

  @ApiProperty({
    description: '分类状态',
    example: 'ENABLED',
    default: 'ENABLED',
  })
  @IsOptional()
  @IsString({ message: '分类状态必须是字符串' })
  status?: string;
}
