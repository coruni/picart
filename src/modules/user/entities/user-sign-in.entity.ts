import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity({ comment: '用户签到记录表' })
export class UserSignIn {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ comment: '用户ID' })
  userId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'date', comment: '签到日期' })
  signInDate: Date;

  @Column({ default: 1, comment: '连续签到天数' })
  consecutiveDays: number;

  @Column({ default: false, comment: '是否为自动签到' })
  isAuto: boolean;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;
}
