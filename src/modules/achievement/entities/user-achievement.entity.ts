import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../user/entities/user.entity';
import { Achievement } from './achievement.entity';

@Entity({ comment: '用户成就表' })
export class UserAchievement {
  @ApiProperty({ description: 'ID' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: '用户ID' })
  @Column({ comment: '用户ID' })
  userId: number;

  @ApiProperty({ description: '成就ID' })
  @Column({ comment: '成就ID' })
  achievementId: number;

  @ApiProperty({ description: '进度' })
  @Column({ default: 0, comment: '当前进度' })
  progress: number;

  @ApiProperty({ description: '是否已完成' })
  @Column({ default: false, comment: '是否已完成' })
  completed: boolean;

  @ApiProperty({ description: '完成时间' })
  @Column({ nullable: true, comment: '完成时间' })
  completedAt: Date;

  @ApiProperty({ description: '是否已领取奖励' })
  @Column({ default: false, comment: '是否已领取奖励' })
  claimed: boolean;

  @ApiProperty({ description: '领取时间' })
  @Column({ nullable: true, comment: '领取时间' })
  claimedAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Achievement)
  @JoinColumn({ name: 'achievementId' })
  achievement: Achievement;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;
}
