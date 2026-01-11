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
import { Decoration } from './decoration.entity';

@Entity({ comment: '用户装饰品表' })
@Index(['userId', 'decorationId'], { unique: true })
export class UserDecoration {
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

  @ApiProperty({ description: '装饰品ID' })
  @Column({ comment: '装饰品ID' })
  decorationId: number;

  @ApiProperty({ description: '装饰品' })
  @ManyToOne(() => Decoration, { eager: true })
  @JoinColumn({ name: 'decorationId' })
  decoration: Decoration;

  @ApiProperty({ description: '获取方式' })
  @Column({
    type: 'enum',
    enum: ['PURCHASE', 'ACTIVITY', 'GIFT', 'ACHIEVEMENT', 'DEFAULT'],
    comment: '获取方式',
  })
  obtainMethod: 'PURCHASE' | 'ACTIVITY' | 'GIFT' | 'ACHIEVEMENT' | 'DEFAULT';

  @ApiProperty({ description: '是否永久' })
  @Column({ default: false, comment: '是否永久有效' })
  isPermanent: boolean;

  @ApiProperty({ description: '过期时间' })
  @Column({
    type: 'datetime',
    nullable: true,
    comment: '过期时间（永久的为NULL）',
  })
  expiresAt: Date | null;

  @ApiProperty({ description: '是否正在使用' })
  @Column({ default: false, comment: '是否正在使用' })
  isUsing: boolean;

  @ApiProperty({ description: '赠送人ID' })
  @Column({ type: 'int', nullable: true, comment: '赠送人ID（如果是赠送获得）' })
  giftFromUserId: number | null;

  @ApiProperty({ description: '订单ID' })
  @Column({ type: 'int', nullable: true, comment: '订单ID（如果是购买获得）' })
  orderId: number | null;

  @ApiProperty({ description: '活动ID' })
  @Column({ type: 'int', nullable: true, comment: '活动ID（如果是活动获得）' })
  activityId: number | null;

  @ApiProperty({ description: '备注' })
  @Column({ type: 'text', nullable: true, comment: '备注' })
  remark: string | null;

  @ApiProperty({ description: '创建时间' })
  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;
}
