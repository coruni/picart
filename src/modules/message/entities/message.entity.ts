import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
