import { IsOptional, IsString, IsEnum, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { Transform } from 'class-transformer';

export class QueryEmojiDto extends PaginationDto {
  @ApiProperty({ description: '表情类型', enum: ['system', 'user'], required: false })
  @IsOptional()
  @IsEnum(['system', 'user'])
  type?: 'system' | 'user';

  @ApiProperty({ description: '分类', required: false })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ description: '关键词搜索', required: false })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiProperty({ description: '是否公开', required: false })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isPublic?: boolean;

  @ApiProperty({ description: '状态', enum: ['active', 'inactive', 'deleted'], required: false })
  @IsOptional()
  @IsEnum(['active', 'inactive', 'deleted'])
  status?: 'active' | 'inactive' | 'deleted';

  @ApiProperty({ description: '用户ID（查询指定用户的表情）', required: false })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({ description: '是否只查询收藏的表情', required: false })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  onlyFavorites?: boolean;
}
