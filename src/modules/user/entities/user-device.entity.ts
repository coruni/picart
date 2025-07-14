import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('user_device')
export class UserDevice {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ comment: '设备ID', length: 128 })
  deviceId: string;

  @Column({ comment: '设备类型', length: 64, nullable: true })
  deviceType: string;

  @Column({ comment: '设备名称', length: 128, nullable: true })
  deviceName: string;

  @Column({ comment: '刷新令牌', length: 512 })
  refreshToken: string;

  @ManyToOne(() => User, user => user.id)
  user: User;

  @Column({ comment: '用户ID' })
  userId: number;

  @CreateDateColumn({ comment: '登录时间' })
  loginAt: Date;

  @UpdateDateColumn({ comment: '最后活跃时间' })
  lastActiveAt: Date;
}
