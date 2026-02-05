import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { PointsActivity } from './points-activity.entity';

@Entity({ comment: '积分任务完成记录表' })
export class PointsTaskRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ comment: '用户ID' })
  userId: number;

  @Column({ comment: '任务ID' })
  taskId: number;

  @Column({ comment: '当前完成数量', type: 'int', default: 0 })
  currentCount: number;

  @Column({ comment: '目标数量', type: 'int' })
  targetCount: number;

  @Column({ comment: '是否完成', default: false })
  isCompleted: boolean;

  @Column({ comment: '完成时间', type: 'datetime', nullable: true })
  completedAt: Date;

  @Column({ comment: '奖励积分', type: 'int' })
  rewardPoints: number;

  @Column({ comment: '是否已领取奖励', default: false })
  isRewarded: boolean;

  @Column({ comment: '领取时间', type: 'datetime', nullable: true })
  rewardedAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => PointsActivity)
  @JoinColumn({ name: 'taskId' })
  task: PointsActivity;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;
}
