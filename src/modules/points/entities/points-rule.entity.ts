import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ comment: '积分规则表' })
export class PointsRule {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ comment: '规则代码', unique: true })
  code: string;

  @Column({ comment: '规则名称' })
  name: string;

  @Column({ comment: '规则描述', type: 'text', nullable: true })
  description: string;

  @Column({ comment: '积分数量', type: 'int' })
  points: number;

  @Column({ comment: '每日限制次数（0为不限制）', type: 'int', default: 0 })
  dailyLimit: number;

  @Column({ comment: '总限制次数（0为不限制）', type: 'int', default: 0 })
  totalLimit: number;

  @Column({ comment: '积分有效期（天数，0为永久）', type: 'int', default: 0 })
  validDays: number;

  @Column({ comment: '是否启用', default: true })
  isActive: boolean;

  @Column({ comment: '排序', type: 'int', default: 0 })
  sort: number;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;
}
