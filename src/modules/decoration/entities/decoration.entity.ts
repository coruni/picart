import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity({ comment: '装饰品表（头像框、评论气泡等）' })
export class Decoration {
  @ApiProperty({ description: '装饰品ID' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: '装饰品名称' })
  @Column({ length: 100, comment: '装饰品名称' })
  name: string;

  @ApiProperty({ description: '装饰品类型' })
  @Column({
    type: 'enum',
    enum: ['AVATAR_FRAME', 'COMMENT_BUBBLE'],
    comment: '装饰品类型：AVATAR_FRAME-头像框，COMMENT_BUBBLE-评论气泡',
  })
  type: 'AVATAR_FRAME' | 'COMMENT_BUBBLE';

  @ApiProperty({ description: '装饰品描述' })
  @Column({ type: 'text', nullable: true, comment: '装饰品描述' })
  description: string;

  @ApiProperty({ description: '装饰品图片URL' })
  @Column({ type: 'text', comment: '装饰品图片URL' })
  imageUrl: string;

  @ApiProperty({ description: '预览图URL' })
  @Column({ type: 'text', nullable: true, comment: '预览图URL' })
  previewUrl: string;

  @ApiProperty({ description: '稀有度' })
  @Column({
    type: 'enum',
    enum: ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'],
    default: 'COMMON',
    comment: '稀有度：COMMON-普通，RARE-稀有，EPIC-史诗，LEGENDARY-传说',
  })
  rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';

  @ApiProperty({ description: '获取方式' })
  @Column({
    type: 'enum',
    enum: ['PURCHASE', 'ACTIVITY', 'GIFT', 'ACHIEVEMENT', 'DEFAULT'],
    comment: '获取方式：PURCHASE-购买，ACTIVITY-活动，GIFT-赠送，ACHIEVEMENT-成就，DEFAULT-默认',
  })
  obtainMethod: 'PURCHASE' | 'ACTIVITY' | 'GIFT' | 'ACHIEVEMENT' | 'DEFAULT';

  @ApiProperty({ description: '是否可购买' })
  @Column({ default: false, comment: '是否可购买' })
  isPurchasable: boolean;

  @ApiProperty({ description: '购买价格' })
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    comment: '购买价格（元）',
  })
  price: number;

  @ApiProperty({ description: '是否永久' })
  @Column({ default: false, comment: '是否永久有效' })
  isPermanent: boolean;

  @ApiProperty({ description: '有效天数' })
  @Column({
    type: 'int',
    nullable: true,
    comment: '有效天数（如果不是永久的）',
  })
  validDays: number | null;

  @ApiProperty({ description: '排序' })
  @Column({ default: 0, comment: '排序（数字越大越靠前）' })
  sort: number;

  @ApiProperty({ description: '状态' })
  @Column({
    type: 'enum',
    enum: ['ACTIVE', 'INACTIVE'],
    default: 'ACTIVE',
    comment: '状态：ACTIVE-启用，INACTIVE-禁用',
  })
  status: 'ACTIVE' | 'INACTIVE';

  @ApiProperty({ description: '关联活动ID' })
  @Column({ type: 'int', nullable: true, comment: '关联活动ID' })
  activityId: number | null;

  @ApiProperty({ description: '所需点赞数' })
  @Column({ default: 0, comment: '获取所需点赞数（0表示不需要）' })
  requiredLikes: number;

  @ApiProperty({ description: '所需评论数' })
  @Column({ default: 0, comment: '获取所需评论数（0表示不需要）' })
  requiredComments: number;

  @ApiProperty({ description: '创建时间' })
  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;
}
