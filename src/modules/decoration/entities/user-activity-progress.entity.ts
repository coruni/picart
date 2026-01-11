import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../user/entities/user.entity';
import { DecorationActivity } from './decoration-activity.entity';

@Entity({ comment: '用户活动进度表' })
@Index(['userId', 'activityId'], { unique: true })
export class UserActivityProgress {
  @ApiProperty({ description: '记录ID' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: '用户ID' })
  @Column({ comment: '用户ID' })
  userId: number;

  @ApiProperty({ description: '用户' })
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ApiProperty({ description: '活动ID' })
  @Column({ comment: '活动ID' })
  activityId: number;

  @ApiProperty({ description: '活动' })
  @ManyToOne(() => DecorationActivity, { eager: true })
  @JoinColumn({ name: 'activityId' })
  activity: DecorationActivity;

  @ApiProperty({ description: '当前点赞数' })
  @Column({ default: 0, comment: '当前点赞数' })
  currentLikes: number;

  @ApiProperty({ description: '当前评论数' })
  @Column({ default: 0, comment: '当前评论数' })
  currentComments: number;

  @ApiProperty({ description: '当前分享数' })
  @Column({ default: 0, comment: '当前分享数' })
  currentShares: number;

  @ApiProperty({ description: '当前充值金额' })
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    comment: '当前充值金额（元）',
  })
  currentRecharge: number;

  @ApiProperty({ description: '当前签到天数' })
  @Column({ default: 0, comment: '当前签到天数' })
  currentSignInDays: number;

  @ApiProperty({ description: '是否已完成' })
  @Column({ default: false, comment: '是否已完成' })
  isCompleted: boolean;

  @ApiProperty({ description: '是否已领取奖励' })
  @Column({ default: false, comment: '是否已领取奖励' })
  isRewarded: boolean;

  @ApiProperty({ description: '完成时间' })
  @Column({
    type: 'datetime',
    nullable: true,
    comment: '完成时间',
  })
  completedAt: Date | null;

  @ApiProperty({ description: '领取时间' })
  @Column({
    type: 'datetime',
    nullable: true,
    comment: '领取时间',
  })
  rewardedAt: Date | null;

  @ApiProperty({ description: '创建时间' })
  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;
}
