import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User } from './user.entity';

@Entity({ comment: '用户配置表' })
export class UserConfig {
  @ApiProperty({ description: '配置ID' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: '用户ID' })
  @Column({ comment: '用户ID' })
  userId: number;

  @OneToOne(() => User, (user) => user.config)
  @JoinColumn({ name: 'userId' })
  user: User;

  @ApiProperty({ description: '文章抽成比例' })
  @Column({
    comment: '文章抽成比例（0-1之间，如0.1表示10%）',
    type: 'decimal',
    precision: 3,
    scale: 2,
    default: 0.1,
  })
  articleCommissionRate: number;

  @ApiProperty({ description: '会员抽成比例' })
  @Column({
    comment: '会员抽成比例（0-1之间，如0.1表示10%）',
    type: 'decimal',
    precision: 3,
    scale: 2,
    default: 0.1,
  })
  membershipCommissionRate: number;

  @ApiProperty({ description: '商品抽成比例' })
  @Column({
    comment: '商品抽成比例（0-1之间，如0.1表示10%）',
    type: 'decimal',
    precision: 3,
    scale: 2,
    default: 0.1,
  })
  productCommissionRate: number;

  @ApiProperty({ description: '服务抽成比例' })
  @Column({
    comment: '服务抽成比例（0-1之间，如0.1表示10%）',
    type: 'decimal',
    precision: 3,
    scale: 2,
    default: 0.1,
  })
  serviceCommissionRate: number;

  @ApiProperty({ description: '是否启用自定义抽成' })
  @Column({
    comment: '是否启用自定义抽成（true-使用个人配置，false-使用全局配置）',
    default: false,
  })
  enableCustomCommission: boolean;

  // 通知设置
  @ApiProperty({ description: '是否接收系统通知' })
  @Column({
    comment: '是否接收系统通知',
    default: true,
  })
  enableSystemNotification: boolean;

  @ApiProperty({ description: '是否接收评论通知' })
  @Column({
    comment: '是否接收评论通知',
    default: true,
  })
  enableCommentNotification: boolean;

  @ApiProperty({ description: '是否接收点赞通知' })
  @Column({
    comment: '是否接收点赞通知',
    default: true,
  })
  enableLikeNotification: boolean;

  @ApiProperty({ description: '是否接收关注通知' })
  @Column({
    comment: '是否接收关注通知',
    default: true,
  })
  enableFollowNotification: boolean;

  @ApiProperty({ description: '是否接收私信通知' })
  @Column({
    comment: '是否接收私信通知',
    default: true,
  })
  enableMessageNotification: boolean;

  @ApiProperty({ description: '是否接收订单通知' })
  @Column({
    comment: '是否接收订单通知',
    default: true,
  })
  enableOrderNotification: boolean;

  @ApiProperty({ description: '是否接收支付通知' })
  @Column({
    comment: '是否接收支付通知',
    default: true,
  })
  enablePaymentNotification: boolean;

  @ApiProperty({ description: '是否接收邀请通知' })
  @Column({
    comment: '是否接收邀请通知',
    default: true,
  })
  enableInviteNotification: boolean;

  @ApiProperty({ description: '是否接收邮件通知' })
  @Column({
    comment: '是否接收邮件通知',
    default: true,
  })
  enableEmailNotification: boolean;

  @ApiProperty({ description: '是否接收短信通知' })
  @Column({
    comment: '是否接收短信通知',
    default: false,
  })
  enableSmsNotification: boolean;

  @ApiProperty({ description: '是否接收推送通知' })
  @Column({
    comment: '是否接收推送通知',
    default: true,
  })
  enablePushNotification: boolean;

  // 隐私设置
  @ApiProperty({ description: '是否隐藏收藏夹' })
  @Column({
    comment: '是否隐藏收藏夹（true-隐藏，false-公开）',
    default: false,
  })
  hideFavorites: boolean;

  @ApiProperty({ description: '备注' })
  @Column({
    comment: '备注',
    nullable: true,
    type: 'text',
  })
  remark: string;

  @ApiProperty({ description: '创建时间' })
  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;
}
