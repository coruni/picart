import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ comment: '积分活动表（合并规则和任务）' })
export class PointsActivity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ comment: '活动代码', unique: true })
  code: string;

  @Column({ comment: '活动名称' })
  name: string;

  @Column({ comment: '活动描述', type: 'text', nullable: true })
  description: string;

  @Column({ 
    comment: '活动类型', 
    type: 'enum', 
    enum: ['INSTANT', 'DAILY', 'WEEKLY', 'MONTHLY', 'ONCE'],
    default: 'INSTANT'
  })
  type: 'INSTANT' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ONCE';

  @Column({ comment: '奖励积分', type: 'int' })
  rewardPoints: number;

  @Column({ comment: '目标数量（INSTANT类型为单次奖励，其他类型为目标完成数）', type: 'int', default: 1 })
  targetCount: number;

  @Column({ comment: '每日限制次数（0为不限制）', type: 'int', default: 0 })
  dailyLimit: number;

  @Column({ comment: '总限制次数（0为不限制）', type: 'int', default: 0 })
  totalLimit: number;

  @Column({ comment: '积分有效期（天数，0为永久）', type: 'int', default: 0 })
  validDays: number;

  @Column({ comment: '活动图标', nullable: true })
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