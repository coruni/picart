import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from "typeorm";
import { Message } from "./message.entity";
import { User } from "../../user/entities/user.entity";

@Entity("message_read")
@Index(["userId", "messageId"], { unique: true })
@Index(["userId", "createdAt"])
export class MessageRead {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index()
  userId: number;

  @Column()
  @Index()
  messageId: number;

  @ManyToOne(() => Message, { onDelete: "CASCADE" })
  @JoinColumn({ name: "messageId" })
  message: Message;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;

  @CreateDateColumn()
  createdAt: Date;
}
