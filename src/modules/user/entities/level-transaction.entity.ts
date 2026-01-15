import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity({ comment: '等级经验交易记录表' })
export class LevelTransaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ comment: '用户ID' })
  userId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ comment: '经验值变化量（正数为获得，负数为扣除）' })
  amount: number;

  @Column({ comment: '变化后的经验值' })
  balance: number;

  @Column({ comment: '变化后的等级' })
  level: number;

  @Column({
    comment: '类型',
    type: 'enum',
    enum: ['EARN', 'SPEND'],
  })
  type: 'EARN' | 'SPEND';

  @Column({ comment: '来源', nullable: true })
  source: string;

  @Column({ comment: '描述', nullable: true })
  description: string;

  @Column({ comment: '关联类型', nullable: true })
  relatedType: string;

  @Column({ comment: '关联ID', nullable: true })
  relatedId: number;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;
}
