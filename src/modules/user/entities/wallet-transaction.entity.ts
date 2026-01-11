import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User } from './user.entity';

@Entity({ comment: '钱包交易记录表' })
export class WalletTransaction {
  @ApiProperty({ description: '交易记录ID' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: '用户ID' })
  @Column({ comment: '用户ID' })
  userId: number;

  @ApiProperty({ description: '用户' })
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ApiProperty({ description: '交易类型' })
  @Column({
    comment: '交易类型：PAYMENT-支付，REFUND-退款，RECHARGE-充值，COMMISSION-佣金，WITHDRAW-提现，ADJUSTMENT-调整',
    type: 'enum',
    enum: ['PAYMENT', 'REFUND', 'RECHARGE', 'COMMISSION', 'WITHDRAW', 'ADJUSTMENT'],
  })
  type: 'PAYMENT' | 'REFUND' | 'RECHARGE' | 'COMMISSION' | 'WITHDRAW' | 'ADJUSTMENT';

  @ApiProperty({ description: '交易金额' })
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    comment: '交易金额（正数为收入，负数为支出）',
  })
  amount: number;

  @ApiProperty({ description: '交易前余额' })
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    comment: '交易前余额',
  })
  balanceBefore: number;

  @ApiProperty({ description: '交易后余额' })
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    comment: '交易后余额',
  })
  balanceAfter: number;

  @ApiProperty({ description: '关联订单ID' })
  @Column({
    nullable: true,
    comment: '关联订单ID',
  })
  orderId: number;

  @ApiProperty({ description: '关联支付记录ID' })
  @Column({
    nullable: true,
    comment: '关联支付记录ID',
  })
  paymentId: number;

  @ApiProperty({ description: '交易描述' })
  @Column({
    type: 'text',
    comment: '交易描述',
  })
  description: string;

  @ApiProperty({ description: '备注' })
  @Column({
    nullable: true,
    type: 'text',
    comment: '备注',
  })
  remark: string;

  @ApiProperty({ description: '创建时间' })
  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;
}
