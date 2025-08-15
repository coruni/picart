import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsArray,
  Min,
  MaxLength,
  ValidateIf,
  IsNotEmpty,
} from 'class-validator';

export class CreateArticleDto {
  @ApiProperty({ description: '文章标题', example: '这是一篇文章' })
  @IsString({ message: '文章标题必须是字符串' })
  @MaxLength(200, { message: '文章标题不能超过200个字符' })
  title: string;

  @ApiProperty({ description: '文章内容', example: '这是文章的内容...' })
  @IsOptional()
  @ValidateIf((o) => o.type === 'mixed')
  @IsString({ message: '文章内容必须是字符串' })
  @IsNotEmpty({ message: '当文章类型为mixed时，内容不能为空' })
  content?: string;

  @ApiProperty({
    description: '文章摘要',
    example: '这是文章的摘要...',
    required: false,
  })
  @IsOptional()
  @IsString({ message: '文章摘要必须是字符串' })
  @MaxLength(500, { message: '文章摘要不能超过500个字符' })
  summary?: string;

  @ApiProperty({
    description: '文章图片',
    example: 'https://example.com/image.jpg',
    required: false,
  })
  @ValidateIf((o) => o.type === 'image')
  @IsString({ message: '文章图片必须是字符串' })
  @IsNotEmpty({ message: '当文章类型为image时，图片不能为空' })
  images?: string;

  @ApiProperty({
    description: '封面图片',
    example: 'https://example.com/image.jpg',
    required: false,
  })
  @IsOptional()
  @IsString({ message: '封面图片必须是字符串' })
  cover?: string;

  @ApiProperty({ description: '排序', example: 0, default: 0 })
  @IsOptional()
  @IsNumber({}, { message: '排序必须是数字' })
  sort?: number;

  @ApiProperty({ description: '分类ID', example: 1 })
  @IsNumber({}, { message: '分类ID必须是数字' })
  categoryId: number;

  @ApiProperty({
    description: '标签名称数组（不存在的标签会自动创建）',
    example: ['JavaScript', 'Vue.js', '前端开发'],
    required: false,
  })
  @IsOptional()
  @IsArray({ message: '标签必须是数组' })
  @IsString({ each: true, message: '标签名称必须是字符串' })
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

  @ApiProperty({ description: '是否需要登录后才能查看', default: false })
  @IsBoolean()
  @IsOptional()
  requireLogin?: boolean = false;

  @ApiProperty({ description: '是否仅关注后可查看', default: false })
  @IsBoolean()
  @IsOptional()
  requireFollow?: boolean = false;

  @ApiProperty({ description: '是否需要支付后才能查看', default: false })
  @IsBoolean()
  @IsOptional()
  requirePayment?: boolean = false;

  @ApiProperty({ description: '是否需要会员才能查看', default: false })
  @IsBoolean()
  @IsOptional()
  requireMembership?: boolean = false;

  @ApiProperty({ description: '查看所需支付金额', default: 0 })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'viewPrice必须为数字' })
  @Min(0)
  @IsOptional()
  viewPrice?: number = 0;

  @ApiProperty({
    description: '文章类型',
    enum: ['image', 'mixed'],
    default: 'mixed',
  })
  @IsEnum(['image', 'mixed'])
  @IsOptional()
  type?: 'image' | 'mixed' = 'mixed';
}