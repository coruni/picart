import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from "typeorm";
import { User } from "../../user/entities/user.entity";
import { MessageRead } from "./message-read.entity";

@Entity("message")
@Index(["receiverId", "isRead", "createdAt"])
@Index(["isBroadcast", "type", "createdAt"])
export class Message {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  @Index()
  senderId: number | null;

  @Column({ type: "int", nullable: true })
  @Index()
  receiverId: number | null;

  @Column({ type: "text" })
  content: string;

  @Column({ default: "private" })
  type: "private" | "system" | "notification";

  @Column({ default: false })
  isRead: boolean;

  @Column({ default: false })
  isBroadcast: boolean;

  @Column({ type: "varchar", length: 255, nullable: true })
  title: string | null;

  @Column({ type: "json", nullable: true })
  metadata: any;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "senderId" })
  sender: User | null;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "receiverId" })
  receiver: User;

  @OneToMany(() => MessageRead, (messageRead) => messageRead.message, {
    cascade: true,
  })
  readRecords: MessageRead[];
}
