import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UploadEmojiDto {
  @ApiProperty({ description: '表情名称', example: '开心' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ description: '表情代码', example: ':smile:', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

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
}
