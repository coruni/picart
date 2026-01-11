import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsBoolean, Min } from 'class-validator';

export class CreateDecorationDto {
  @ApiProperty({ description: '装饰品名称' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: '装饰品类型', enum: ['AVATAR_FRAME', 'COMMENT_BUBBLE'] })
  @IsEnum(['AVATAR_FRAME', 'COMMENT_BUBBLE'])
  @IsNotEmpty()
  type: 'AVATAR_FRAME' | 'COMMENT_BUBBLE';

  @ApiProperty({ description: '装饰品描述', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: '装饰品图片URL' })
  @IsString()
  @IsNotEmpty()
  imageUrl: string;

  @ApiProperty({ description: '预览图URL', required: false })
  @IsString()
  @IsOptional()
  previewUrl?: string;

  @ApiProperty({ description: '稀有度', enum: ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'], required: false })
  @IsEnum(['COMMON', 'RARE', 'EPIC', 'LEGENDARY'])
  @IsOptional()
  rarity?: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';

  @ApiProperty({ description: '获取方式', enum: ['PURCHASE', 'ACTIVITY', 'GIFT', 'ACHIEVEMENT', 'DEFAULT'] })
  @IsEnum(['PURCHASE', 'ACTIVITY', 'GIFT', 'ACHIEVEMENT', 'DEFAULT'])
  @IsNotEmpty()
  obtainMethod: 'PURCHASE' | 'ACTIVITY' | 'GIFT' | 'ACHIEVEMENT' | 'DEFAULT';

  @ApiProperty({ description: '是否可购买', required: false })
  @IsBoolean()
  @IsOptional()
  isPurchasable?: boolean;

  @ApiProperty({ description: '购买价格', required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @ApiProperty({ description: '是否永久', required: false })
  @IsBoolean()
  @IsOptional()
  isPermanent?: boolean;

  @ApiProperty({ description: '有效天数', required: false })
  @IsNumber()
  @Min(1)
  @IsOptional()
  validDays?: number;

  @ApiProperty({ description: '排序', required: false })
  @IsNumber()
  @IsOptional()
  sort?: number;

  @ApiProperty({ description: '所需点赞数', required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  requiredLikes?: number;

  @ApiProperty({ description: '所需评论数', required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  requiredComments?: number;
}
