import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Decoration } from './decoration.entity';

@Entity({ comment: '装饰品活动表' })
export class DecorationActivity {
  @ApiProperty({ description: '活动ID' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: '活动名称' })
  @Column({ length: 100, comment: '活动名称' })
  name: string;

  @ApiProperty({ description: '活动描述' })
  @Column({ type: 'text', nullable: true, comment: '活动描述' })
  description: string;

  @ApiProperty({ description: '活动类型' })
  @Column({
    type: 'enum',
    enum: ['LIKE', 'COMMENT', 'SHARE', 'RECHARGE', 'SIGN_IN', 'CUSTOM'],
    comment: '活动类型：LIKE-点赞，COMMENT-评论，SHARE-分享，RECHARGE-充值，SIGN_IN-签到，CUSTOM-自定义',
  })
  type: 'LIKE' | 'COMMENT' | 'SHARE' | 'RECHARGE' | 'SIGN_IN' | 'CUSTOM';

  @ApiProperty({ description: '奖励装饰品ID' })
  @Column({ comment: '奖励装饰品ID' })
  decorationId: number;

  @ApiProperty({ description: '奖励装饰品' })
  @ManyToOne(() => Decoration, { eager: true })
  @JoinColumn({ name: 'decorationId' })
  decoration: Decoration;

  @ApiProperty({ description: '所需点赞数' })
  @Column({ default: 0, comment: '所需点赞数（0表示不需要）' })
  requiredLikes: number;

  @ApiProperty({ description: '所需评论数' })
  @Column({ default: 0, comment: '所需评论数（0表示不需要）' })
  requiredComments: number;

  @ApiProperty({ description: '所需分享数' })
  @Column({ default: 0, comment: '所需分享数（0表示不需要）' })
  requiredShares: number;

  @ApiProperty({ description: '所需充值金额' })
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    comment: '所需充值金额（元）',
  })
  requiredRecharge: number;

  @ApiProperty({ description: '所需签到天数' })
  @Column({ default: 0, comment: '所需签到天数（0表示不需要）' })
  requiredSignInDays: number;

  @ApiProperty({ description: '奖励是否永久' })
  @Column({ default: false, comment: '奖励是否永久' })
  isPermanent: boolean;

  @ApiProperty({ description: '奖励有效天数' })
  @Column({
    type: 'int',
    nullable: true,
    comment: '奖励有效天数（如果不是永久的）',
  })
  validDays: number | null;

  @ApiProperty({ description: '开始时间' })
  @Column({ type: 'datetime', comment: '活动开始时间' })
  startTime: Date;

  @ApiProperty({ description: '结束时间' })
  @Column({ type: 'datetime', comment: '活动结束时间' })
  endTime: Date;

  @ApiProperty({ description: '状态' })
  @Column({
    type: 'enum',
    enum: ['ACTIVE', 'INACTIVE', 'ENDED'],
    default: 'ACTIVE',
    comment: '状态：ACTIVE-进行中，INACTIVE-未开始，ENDED-已结束',
  })
  status: 'ACTIVE' | 'INACTIVE' | 'ENDED';

  @ApiProperty({ description: '参与人数' })
  @Column({ default: 0, comment: '参与人数' })
  participantCount: number;

  @ApiProperty({ description: '完成人数' })
  @Column({ default: 0, comment: '完成人数' })
  completedCount: number;

  @ApiProperty({ description: '创建时间' })
  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;
}
