import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ comment: '积分任务表' })
export class PointsTask {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ comment: '任务代码', unique: true })
  code: string;

  @Column({ comment: '任务名称' })
  name: string;

  @Column({ comment: '任务描述', type: 'text', nullable: true })
  description: string;

  @Column({ comment: '任务类型', type: 'enum', enum: ['DAILY', 'WEEKLY', 'MONTHLY', 'ONCE'] })
  type: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ONCE';

  @Column({ comment: '奖励积分', type: 'int' })
  rewardPoints: number;

  @Column({ comment: '目标数量', type: 'int', default: 1 })
  targetCount: number;

  @Column({ comment: '任务图标', nullable: true })
  icon: string;

  @Column({ comment: '跳转链接', nullable: true })
  link: string;

  @Column({ comment: '是否启用', default: true })
  isActive: boolean;

  @Column({ comment: '排序', type: 'int', default: 0 })
  sort: number;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;
}
