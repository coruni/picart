import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { MessageRead } from './message-read.entity';

@Entity('message')
export class Message {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  senderId: number;

  @Column({ type: 'int', nullable: true })
  receiverId: number | null;

  @Column({ type: 'text' })
  content: string;

  @Column({ default: 'private' })
  type: 'private' | 'system' | 'notification';

  @Column({ default: false })
  isRead: boolean;

  @Column({ default: false })
  isBroadcast: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  title: string | null;

  @Column({ type: 'json', nullable: true })
  metadata: any;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // 关联关系
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'senderId' })
  sender: User;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'receiverId' })
  receiver: User;

  @OneToMany(() => MessageRead, messageRead => messageRead.message, { cascade: true })
  readRecords: MessageRead[];
}
