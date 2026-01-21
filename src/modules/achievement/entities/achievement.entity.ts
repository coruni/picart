import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity({ comment: '成就表' })
export class Achievement {
  @ApiProperty({ description: '成就ID' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: '成就代码（唯一标识）' })
  @Column({ unique: true, comment: '成就代码' })
  code: string;

  @ApiProperty({ description: '成就名称' })
  @Column({ comment: '成就名称' })
  name: string;

  @ApiProperty({ description: '成就描述' })
  @Column({ type: 'text', comment: '成就描述' })
  description: string;

  @ApiProperty({ description: '成就图标' })
  @Column({ nullable: true, comment: '成就图标URL' })
  icon: string;

  @ApiProperty({ description: '成就类型' })
  @Column({
    type: 'enum',
    enum: ['ARTICLE', 'COMMENT', 'SOCIAL', 'LEVEL', 'SPECIAL'],
    comment: '成就类型：ARTICLE-文章相关，COMMENT-评论相关，SOCIAL-社交相关，LEVEL-等级相关，SPECIAL-特殊成就',
  })
  type: 'ARTICLE' | 'COMMENT' | 'SOCIAL' | 'LEVEL' | 'SPECIAL';

  @ApiProperty({ description: '稀有度' })
  @Column({
    type: 'enum',
    enum: ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'],
    default: 'COMMON',
    comment: '稀有度',
  })
  rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';

  @ApiProperty({ description: '完成条件（JSON格式）' })
  @Column({ type: 'json', comment: '完成条件' })
  condition: {
    type: string; // 条件类型：count, threshold, etc.
    target?: number; // 目标值
    [key: string]: any;
  };

  @ApiProperty({ description: '奖励积分' })
  @Column({ default: 0, comment: '奖励积分' })
  rewardPoints: number;

  @ApiProperty({ description: '奖励经验' })
  @Column({ default: 0, comment: '奖励经验' })
  rewardExp: number;

  @ApiProperty({ description: '奖励装饰品ID' })
  @Column({ nullable: true, comment: '奖励装饰品ID' })
  rewardDecorationId: number;

  @ApiProperty({ description: '是否隐藏' })
  @Column({ default: false, comment: '是否隐藏（未解锁前不显示）' })
  hidden: boolean;

  @ApiProperty({ description: '排序' })
  @Column({ default: 0, comment: '排序' })
  sort: number;

  @ApiProperty({ description: '是否启用' })
  @Column({ default: true, comment: '是否启用' })
  enabled: boolean;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;
}
