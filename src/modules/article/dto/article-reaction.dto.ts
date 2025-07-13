import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class ArticleLikeDto {
  @ApiProperty({
    description: '表情类型',
    enum: ['like', 'love', 'haha', 'wow', 'sad', 'angry', 'dislike'],
    example: 'like',
    default: 'like',
  })
  @IsOptional()
  @IsEnum(['like', 'love', 'haha', 'wow', 'sad', 'angry', 'dislike'], {
    message: '表情类型必须是：like, love, haha, wow, sad, angry, dislike 中的一个',
  })
  reactionType?: 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'angry' | 'dislike';
}
