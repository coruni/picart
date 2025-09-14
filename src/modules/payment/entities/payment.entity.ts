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
import { Order } from '../../order/entities/order.entity';
import { User } from '../../user/entities/user.entity';

@Entity({ comment: '支付记录表' })
export class Payment {
  @ApiProperty({ description: '支付记录ID' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: '订单ID' })
  @Column({ comment: '订单ID' })
  orderId: number;

  @ApiProperty({ description: '用户ID' })
  @Column({ comment: '用户ID' })
  userId: number;

  @ApiProperty({ description: '支付方式' })
  @Column({
    comment: '支付方式：ALIPAY-支付宝，WECHAT-微信，BALANCE-余额支付，EPAY-易支付',
    type: 'enum',
    enum: ['ALIPAY', 'WECHAT', 'BALANCE', 'EPAY'],
  })
  paymentMethod: string;

  @ApiProperty({ description: '支付金额' })
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    comment: '支付金额（元）',
  })
  amount: number;

  @ApiProperty({ description: '第三方支付订单号' })
  @Column({
    nullable: true,
    comment: '第三方支付订单号',
  })
  thirdPartyOrderNo: string;

  @ApiProperty({ description: '支付状态' })
  @Column({
    default: 'PENDING',
    comment: '支付状态：PENDING-待支付，SUCCESS-支付成功，FAILED-支付失败，CANCELLED-已取消',
    type: 'enum',
    enum: ['PENDING', 'SUCCESS', 'FAILED', 'CANCELLED'],
  })
  status: string;

  @ApiProperty({ description: '支付时间' })
  @Column({
    nullable: true,
    type: 'datetime',
    comment: '支付时间',
  })
  paidAt: Date;

  @ApiProperty({ description: '支付详情' })
  @Column({
    type: 'json',
    nullable: true,
    comment: '支付详情（JSON格式）',
  })
  details: any;

  @ApiProperty({ description: '错误信息' })
  @Column({
    nullable: true,
    type: 'text',
    comment: '错误信息',
  })
  errorMessage: string;

  @ApiProperty({ description: '创建时间' })
  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;

  // 关联关系
  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;
}
