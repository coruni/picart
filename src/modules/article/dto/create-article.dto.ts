import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsString as IsStringArray,
  MaxLength,
} from 'class-validator';

export class CreateArticleDto {
  @ApiProperty({ description: '文章标题', example: '这是一篇文章' })
  @IsNotEmpty({ message: '文章标题不能为空' })
  @IsString({ message: '文章标题必须是字符串' })
  @MaxLength(200, { message: '文章标题不能超过200个字符' })
  title: string;

  @ApiProperty({ description: '文章内容', example: '这是文章的内容...' })
  @IsNotEmpty({ message: '文章内容不能为空' })
  @IsString({ message: '文章内容必须是字符串' })
  content: string;

  @ApiProperty({ description: '文章摘要', example: '这是文章的摘要...', required: false })
  @IsOptional()
  @IsString({ message: '文章摘要必须是字符串' })
  @MaxLength(500, { message: '文章摘要不能超过500个字符' })
  summary?: string;

  @ApiProperty({
    description: '文章图片',
    example: 'https://example.com/image.jpg',
    required: false,
  })
  @IsOptional()
  @IsString({ message: '文章图片必须是字符串' })
  images?: string;

  @ApiProperty({
    description: '封面图片',
    example: 'https://example.com/image.jpg',
    required: false,
  })
  @IsOptional()
  @IsString({ message: '封面图片必须是字符串' })
  cover?: string;

  @ApiProperty({ description: '分类ID', example: 1 })
  @IsNotEmpty({ message: '分类ID不能为空' })
  @IsNumber({}, { message: '分类ID必须是数字' })
  categoryId: number;

  @ApiProperty({
    description: '标签名称数组（不存在的标签会自动创建）',
    example: ['JavaScript', 'Vue.js', '前端开发'],
    required: false,
  })
  @IsOptional()
  @IsArray({ message: '标签必须是数组' })
  @IsStringArray({ each: true, message: '标签名称必须是字符串' })
  tagNames?: string[];

  @ApiProperty({
    description: '标签ID数组（与tagNames二选一）',
    example: [1, 2, 3],
    required: false,
  })
  @IsOptional()
  @IsArray({ message: '标签ID必须是数组' })
  @IsNumber({}, { each: true, message: '标签ID必须是数字' })
  tagIds?: number[];

  @ApiProperty({
    description: '文章状态',
    example: 'DRAFT',
    enum: ['DRAFT', 'PUBLISHED'],
    default: 'DRAFT',
    required: false,
  })
  @IsOptional()
  @IsString({ message: '状态必须是字符串' })
  status?: string;
}
