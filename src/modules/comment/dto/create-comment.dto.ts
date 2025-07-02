import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({ description: '评论内容', example: '这是一条评论' })
  @IsNotEmpty({ message: '评论内容不能为空' })
  @IsString({ message: '评论内容必须是字符串' })
  content: string;

  @ApiProperty({ description: '文章ID', example: 1 })
  @IsNotEmpty({ message: '文章ID不能为空' })
  @IsNumber({}, { message: '文章ID必须是数字' })
  articleId: number;

  @ApiProperty({ description: '父评论ID', example: 1, required: false })
  @IsOptional()
  @IsNumber({}, { message: '父评论ID必须是数字' })
  parentId?: number;
}
