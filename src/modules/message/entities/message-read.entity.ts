import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Message } from './message.entity';

@Entity('message_read')
export class MessageRead {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column()
  messageId: number;

  @ManyToOne(() => Message)
  @JoinColumn({ name: 'messageId' })
  message: Message;

  @CreateDateColumn()
  createdAt: Date;
}
