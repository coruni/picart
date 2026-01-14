import { IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddToFavoriteDto {
  @ApiProperty({ description: '收藏夹ID' })
  @IsNumber()
  favoriteId: number;

  @ApiProperty({ description: '文章ID' })
  @IsNumber()
  articleId: number;

  @ApiPropertyOptional({ description: '备注' })
  @IsOptional()
  @IsString()
  note?: string;
}
