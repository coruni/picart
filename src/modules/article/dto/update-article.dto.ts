import { PartialType } from '@nestjs/swagger';
import { CreateArticleDto } from './create-article.dto';
import { IsOptional, IsArray, IsNumber, IsString, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { DownloadDto } from './download.dto';

export class UpdateArticleDto extends PartialType(CreateArticleDto) {
  @ApiProperty({ description: '分类ID', example: 1, required: false })
  @IsOptional()
  @IsNumber({}, { message: '分类ID必须是数字' })
  categoryId?: number;

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
    description: '下载资源列表',
    type: [DownloadDto],
    required: false,
  })
  @IsOptional()
  @IsArray({ message: '下载资源必须是数组' })
  @ValidateNested({ each: true })
  @Type(() => DownloadDto)
  downloads?: DownloadDto[];
}
