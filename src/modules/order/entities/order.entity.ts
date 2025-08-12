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

@Entity({ comment: '订单表' })
export class Order {
  @ApiProperty({ description: '订单ID' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: '用户ID（买家）' })
  @Column({ comment: '用户ID（买家）' })
  userId: number;

  @ApiProperty({ description: '用户（买家）' })
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ApiProperty({ description: '作者ID（卖家）' })
  @Column({ comment: '作者ID（卖家）' })
  authorId: number;

  @ApiProperty({ description: '文章ID（当订单类型为ARTICLE时）' })
  @Column({ nullable: true, comment: '文章ID（当订单类型为ARTICLE时）' })
  articleId: number;

  @ApiProperty({ description: '订单号' })
  @Column({
    unique: true,
    comment: '订单号',
  })
  orderNo: string;

  @ApiProperty({ description: '订单类型' })
  @Column({
    comment: '订单类型：MEMBERSHIP-会员充值，PRODUCT-商品购买，SERVICE-服务购买，ARTICLE-文章付费',
    type: 'enum',
    enum: ['MEMBERSHIP', 'PRODUCT', 'SERVICE', 'ARTICLE'],
  })
  type: string;

  @ApiProperty({ description: '订单标题' })
  @Column({
    comment: '订单标题',
  })
  title: string;

  @ApiProperty({ description: '订单金额' })
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    comment: '订单金额（元）',
  })
  amount: number;

  @ApiProperty({ description: '支付方式' })
  @Column({
    nullable: true,
    comment: '支付方式：ALIPAY-支付宝，WECHAT-微信，BANK-银行卡，BALANCE-余额支付',
  })
  paymentMethod: string;

  @ApiProperty({ description: '支付订单号' })
  @Column({
    nullable: true,
    comment: '第三方支付订单号',
  })
  paymentOrderNo: string;

  @ApiProperty({ description: '订单状态' })
  @Column({
    default: 'PENDING',
    comment: '订单状态：PENDING-待支付，PAID-已支付，CANCELLED-已取消，REFUNDED-已退款',
    type: 'enum',
    enum: ['PENDING', 'PAID', 'CANCELLED', 'REFUNDED'],
  })
  status: string;

  @ApiProperty({ description: '支付时间' })
  @Column({
    nullable: true,
    type: 'datetime',
    comment: '支付时间',
  })
  paidAt: Date;

  @ApiProperty({ description: '订单详情' })
  @Column({
    type: 'json',
    nullable: true,
    comment: '订单详情（JSON格式）',
  })
  details: any;

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

  @ApiProperty({ description: '更新时间' })
  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;
}
