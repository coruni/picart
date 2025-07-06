import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../user/entities/user.entity';
import { Order } from '../../order/entities/order.entity';
import { Invite } from './invite.entity';

@Entity({ comment: '邀请分成记录表' })
export class InviteCommission {
  @ApiProperty({ description: '分成记录ID' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: '邀请ID' })
  @Column({ comment: '邀请ID', type: 'int' })
  inviteId: number;

  @ApiProperty({ description: '邀请人ID' })
  @Column({ comment: '邀请人ID', type: 'int' })
  inviterId: number;

  @ApiProperty({ description: '被邀请人ID' })
  @Column({ comment: '被邀请人ID', type: 'int' })
  inviteeId: number;

  @ApiProperty({ description: '订单ID' })
  @Column({ comment: '订单ID', type: 'int' })
  orderId: number;

  @ApiProperty({ description: '订单类型' })
  @Column({ 
    comment: '订单类型：MEMBERSHIP-会员充值，PRODUCT-商品购买，SERVICE-服务购买，ARTICLE-文章付费',
    type: 'enum',
    enum: ['MEMBERSHIP', 'PRODUCT', 'SERVICE', 'ARTICLE']
  })
  orderType: string;

  @ApiProperty({ description: '订单金额' })
  @Column({ 
    type: 'decimal',
    precision: 10,
    scale: 2,
    comment: '订单金额（元）' 
  })
  orderAmount: number;

  @ApiProperty({ description: '分成比例' })
  @Column({ 
    comment: '分成比例（0-1之间）', 
    type: 'decimal',
    precision: 3,
    scale: 2
  })
  commissionRate: number;

  @ApiProperty({ description: '分成金额' })
  @Column({ 
    type: 'decimal',
    precision: 10,
    scale: 2,
    comment: '分成金额（元）' 
  })
  commissionAmount: number;

  @ApiProperty({ description: '分成状态' })
  @Column({ 
    default: 'PENDING',
    comment: '分成状态：PENDING-待发放，PAID-已发放，CANCELLED-已取消',
    type: 'enum',
    enum: ['PENDING', 'PAID', 'CANCELLED']
  })
  status: string;

  @ApiProperty({ description: '发放时间' })
  @Column({ 
    nullable: true,
    type: 'datetime',
    comment: '发放时间' 
  })
  paidAt: Date | null;

  @ApiProperty({ description: '备注' })
  @Column({ 
    nullable: true,
    type: 'text',
    comment: '备注' 
  })
  remark: string | null;

  @ManyToOne(() => Invite)
  @JoinColumn({ name: 'inviteId' })
  invite: Invite;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'inviterId' })
  inviter: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'inviteeId' })
  invitee: User;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @ApiProperty({ description: '创建时间' })
  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;
} 