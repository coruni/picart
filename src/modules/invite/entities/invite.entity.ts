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

@Entity({ comment: '邀请表' })
export class Invite {
  @ApiProperty({ description: '邀请ID' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: '邀请人ID' })
  @Column({ comment: '邀请人ID', type: 'int' })
  inviterId: number;

  @ApiProperty({ description: '被邀请人ID' })
  @Column({ comment: '被邀请人ID', nullable: true, type: 'int' })
  inviteeId: number | null;

  @ApiProperty({ description: '邀请码' })
  @Column({
    unique: true,
    comment: '邀请码',
    type: 'varchar',
    length: 255,
  })
  inviteCode: string;

  @ApiProperty({ description: '邀请状态' })
  @Column({
    default: 'PENDING',
    comment: '邀请状态：PENDING-待使用，USED-已使用，EXPIRED-已过期',
    type: 'enum',
    enum: ['PENDING', 'USED', 'EXPIRED'],
  })
  status: string;

  @ApiProperty({ description: '邀请类型' })
  @Column({
    default: 'GENERAL',
    comment: '邀请类型：GENERAL-普通邀请，VIP-VIP邀请',
    type: 'enum',
    enum: ['GENERAL', 'VIP'],
  })
  type: string;

  @ApiProperty({ description: '邀请分成比例' })
  @Column({
    comment: '邀请分成比例（0-1之间，如0.1表示10%）',
    type: 'decimal',
    precision: 3,
    scale: 2,
    default: 0.05,
  })
  commissionRate: number;

  @ApiProperty({ description: '邀请链接' })
  @Column({
    nullable: true,
    comment: '邀请链接',
    type: 'varchar',
    length: 500,
  })
  inviteUrl: string | null;

  @ApiProperty({ description: '使用时间' })
  @Column({
    nullable: true,
    type: 'datetime',
    comment: '使用时间',
  })
  usedAt: Date | null;

  @ApiProperty({ description: '过期时间' })
  @Column({
    nullable: true,
    type: 'datetime',
    comment: '过期时间',
  })
  expiredAt: Date | null;

  @ApiProperty({ description: '备注' })
  @Column({
    nullable: true,
    type: 'text',
    comment: '备注',
  })
  remark: string | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'inviterId' })
  inviter: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'inviteeId' })
  invitee: User;

  @ApiProperty({ description: '创建时间' })
  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;
}
