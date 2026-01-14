import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsArray, ArrayMaxSize } from 'class-validator';

export class UpdateCommentDto {
  @ApiProperty({ description: '评论内容', example: '这是一条更新的评论', required: false })
  @IsOptional()
  @IsString({ message: '评论内容必须是字符串' })
  content?: string;

  @ApiProperty({ 
    description: '评论图片列表（最多9张）', 
    example: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
    required: false,
    type: [String]
  })
  @IsOptional()
  @IsArray({ message: '图片列表必须是数组' })
  @IsString({ each: true, message: '图片URL必须是字符串' })
  @ArrayMaxSize(9, { message: '最多上传9张图片' })
  images?: string[];
}
