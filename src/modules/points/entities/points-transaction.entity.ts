import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../user/entities/user.entity';

@Entity({ comment: '积分交易记录表' })
export class PointsTransaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ comment: '用户ID' })
  userId: number;

  @Column({ comment: '积分变动数量（正数为增加，负数为减少）', type: 'int' })
  amount: number;

  @Column({ comment: '变动后的积分余额', type: 'int' })
  balance: number;

  @Column({ 
    comment: '交易类型', 
    type: 'enum',
    enum: ['EARN', 'SPEND', 'ADMIN_ADJUST', 'EXPIRE', 'REFUND']
  })
  type: 'EARN' | 'SPEND' | 'ADMIN_ADJUST' | 'EXPIRE' | 'REFUND';

  @Column({ comment: '积分来源/用途', nullable: true })
  source: string;

  @Column({ comment: '关联业务类型', nullable: true })
  relatedType: string;

  @Column({ comment: '关联业务ID', nullable: true })
  relatedId: number;

  @Column({ comment: '描述', type: 'text', nullable: true })
  description: string;

  @Column({ comment: '过期时间', type: 'datetime', nullable: true })
  expiredAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;
}
