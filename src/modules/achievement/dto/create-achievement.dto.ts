import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum, IsNumber, IsBoolean, IsOptional, IsObject } from 'class-validator';

export class CreateAchievementDto {
  @ApiProperty({ description: '成就代码（唯一标识）', example: 'FIRST_ARTICLE' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ description: '成就名称', example: '初出茅庐' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: '成就描述', example: '发布第一篇文章' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ description: '成就图标URL', required: false })
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiProperty({ description: '成就类型', enum: ['ARTICLE', 'COMMENT', 'SOCIAL', 'LEVEL', 'SPECIAL'] })
  @IsEnum(['ARTICLE', 'COMMENT', 'SOCIAL', 'LEVEL', 'SPECIAL'])
  type: 'ARTICLE' | 'COMMENT' | 'SOCIAL' | 'LEVEL' | 'SPECIAL';

  @ApiProperty({ description: '稀有度', enum: ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'], default: 'COMMON' })
  @IsEnum(['COMMON', 'RARE', 'EPIC', 'LEGENDARY'])
  @IsOptional()
  rarity?: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';

  @ApiProperty({ 
    description: '完成条件', 
    example: { type: 'count', target: 1, event: 'article.created' } 
  })
  @IsObject()
  condition: {
    type: string;
    target?: number;
    [key: string]: any;
  };

  @ApiProperty({ description: '奖励积分', default: 0 })
  @IsNumber()
  @IsOptional()
  rewardPoints?: number;

  @ApiProperty({ description: '奖励经验', default: 0 })
  @IsNumber()
  @IsOptional()
  rewardExp?: number;

  @ApiProperty({ description: '奖励装饰品ID', required: false })
  @IsNumber()
  @IsOptional()
  rewardDecorationId?: number;

  @ApiProperty({ description: '是否隐藏', default: false })
  @IsBoolean()
  @IsOptional()
  hidden?: boolean;

  @ApiProperty({ description: '排序', default: 0 })
  @IsNumber()
  @IsOptional()
  sort?: number;

  @ApiProperty({ description: '是否启用', default: true })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}
