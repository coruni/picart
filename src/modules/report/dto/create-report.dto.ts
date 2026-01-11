import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateIf } from 'class-validator';

export class CreateReportDto {
  @ApiProperty({ description: '举报类型', enum: ['USER', 'ARTICLE', 'COMMENT'] })
  @IsEnum(['USER', 'ARTICLE', 'COMMENT'])
  @IsNotEmpty()
  type: 'USER' | 'ARTICLE' | 'COMMENT';

  @ApiProperty({ description: '举报原因' })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiProperty({
    description: '举报分类',
    enum: ['SPAM', 'ABUSE', 'INAPPROPRIATE', 'COPYRIGHT', 'OTHER'],
  })
  @IsEnum(['SPAM', 'ABUSE', 'INAPPROPRIATE', 'COPYRIGHT', 'OTHER'])
  @IsNotEmpty()
  category: 'SPAM' | 'ABUSE' | 'INAPPROPRIATE' | 'COPYRIGHT' | 'OTHER';

  @ApiProperty({ description: '详细描述', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: '被举报用户ID', required: false })
  @ValidateIf((o) => o.type === 'USER')
  @IsNumber()
  @IsNotEmpty()
  reportedUserId?: number;

  @ApiProperty({ description: '被举报文章ID', required: false })
  @ValidateIf((o) => o.type === 'ARTICLE')
  @IsNumber()
  @IsNotEmpty()
  reportedArticleId?: number;

  @ApiProperty({ description: '被举报评论ID', required: false })
  @ValidateIf((o) => o.type === 'COMMENT')
  @IsNumber()
  @IsNotEmpty()
  reportedCommentId?: number;
}
