import { IsString, IsOptional, IsBoolean, IsEnum, MaxLength, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateEmojiDto {
  @ApiProperty({ description: '表情名称', example: '开心' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ description: '表情图片URL', example: 'https://example.com/emoji.png' })
  @IsString()
  @MaxLength(500)
  url: string;

  @ApiProperty({ description: '表情代码', example: ':smile:', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @ApiProperty({ description: '表情类型', enum: ['system', 'user'], default: 'user' })
  @IsOptional()
  @IsEnum(['system', 'user'])
  type?: 'system' | 'user';

  @ApiProperty({ description: '分类', example: '开心', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @ApiProperty({ description: '标签（逗号分隔）', example: '开心,笑脸,高兴', required: false })
  @IsOptional()
  @IsString()
  tags?: string;

  @ApiProperty({ description: '是否公开', default: true })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiProperty({ description: '宽度', required: false })
  @IsOptional()
  @IsNumber()
  width?: number;

  @ApiProperty({ description: '高度', required: false })
  @IsOptional()
  @IsNumber()
  height?: number;

  @ApiProperty({ description: '文件大小', required: false })
  @IsOptional()
  @IsNumber()
  fileSize?: number;

  @ApiProperty({ description: '文件类型', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  mimeType?: string;
}
